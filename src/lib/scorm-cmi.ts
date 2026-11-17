import { z } from "zod";

export const scormWritableKeys = [
  "cmi.core.lesson_status",
  "cmi.core.lesson_location",
  "cmi.core.score.raw",
  "cmi.core.score.min",
  "cmi.core.score.max",
  "cmi.core.session_time",
  "cmi.core.exit",
  "cmi.suspend_data",
] as const;
export type ScormCmi = Partial<
  Record<(typeof scormWritableKeys)[number], string>
>;

const score = z
  .string()
  .max(24)
  .refine(
    (value) =>
      value === "" ||
      (/^-?\d+(?:\.\d+)?$/.test(value) && Math.abs(Number(value)) <= 1_000_000),
    "Invalid SCORM score.",
  );
export const scormCmiSchema = z
  .object({
    "cmi.core.lesson_status": z
      .enum([
        "passed",
        "completed",
        "failed",
        "incomplete",
        "browsed",
        "not attempted",
      ])
      .optional(),
    "cmi.core.lesson_location": z.string().max(255).optional(),
    "cmi.core.score.raw": score.optional(),
    "cmi.core.score.min": score.optional(),
    "cmi.core.score.max": score.optional(),
    "cmi.core.session_time": z
      .string()
      .regex(/^\d{2,4}:[0-5]\d:[0-5]\d(?:\.\d{1,2})?$/)
      .refine(
        (value) => scormTimeSeconds(value) <= 8 * 3600,
        "Session time exceeds eight hours.",
      )
      .optional(),
    "cmi.core.exit": z.enum(["", "time-out", "suspend", "logout"]).optional(),
    "cmi.suspend_data": z.string().max(4096).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const min = Number(value["cmi.core.score.min"] || "0");
    const max = Number(value["cmi.core.score.max"] || "100");
    if (min > max)
      ctx.addIssue({
        code: "custom",
        message: "Minimum score must not exceed maximum score.",
      });
    const raw = value["cmi.core.score.raw"];
    if (raw && (Number(raw) < min || Number(raw) > max))
      ctx.addIssue({
        code: "custom",
        message: "Score is outside the declared range.",
      });
  });

export const scormCommitSchema = z
  .object({
    sessionId: z.string().min(1).max(100),
    sequence: z.number().int().min(1).max(1_000_000),
    cmi: scormCmiSchema,
    finish: z.boolean().optional(),
  })
  .strict();

export function scormTimeSeconds(value: string) {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return Math.floor(hours * 3600 + minutes * 60 + seconds);
}

export function scormTimeString(seconds: number) {
  return `${Math.floor(seconds / 3600)
    .toString()
    .padStart(4, "0")}:${Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

export function resumeScormCmi(lastStatement: unknown): ScormCmi {
  if (
    !lastStatement ||
    typeof lastStatement !== "object" ||
    !("cmi" in lastStatement)
  )
    return {};
  const result = scormCmiSchema.safeParse(lastStatement.cmi);
  return result.success ? result.data : {};
}

/** Runs inside an opaque-origin sandbox, before the imported package scripts. */
export function scormBootstrap(config: {
  sessionId: string;
  channel: string;
  sequence: number;
  cmi: Record<string, string>;
  parentOrigin: string;
}) {
  const serialized = JSON.stringify(config)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<script>(function(){
    "use strict";
    var config=${serialized}, data=config.cmi, initialized=false, finished=false, error="0", sequence=config.sequence;
    var writable=${JSON.stringify(scormWritableKeys)};
    function fail(code){error=code;return "false";}
    function commit(finish){
      var state={}; writable.forEach(function(key){if(data[key]!==undefined)state[key]=data[key];});
      parent.postMessage({type:"athenemy:scorm:commit",channel:config.channel,sessionId:config.sessionId,sequence:++sequence,cmi:state,finish:finish},config.parentOrigin);
      error="0";return "true";
    }
    window.API={
      LMSInitialize:function(arg){if(arg!=="")return fail("201");if(initialized||finished)return fail("101");initialized=true;error="0";return "true";},
      LMSFinish:function(arg){if(arg!=="")return fail("201");if(!initialized||finished)return fail("301");commit(true);finished=true;return "true";},
      LMSGetValue:function(key){if(!initialized||finished){error="301";return "";}if(!(key in data)){error="401";return "";}error="0";return data[key];},
      LMSSetValue:function(key,value){
        if(!initialized||finished)return fail("301");
        if(writable.indexOf(key)===-1)return fail(key in data?"403":"401");
        if(typeof value!=="string")return fail("405");
        if(key==="cmi.core.lesson_status"&&["passed","completed","failed","incomplete","browsed","not attempted"].indexOf(value)===-1)return fail("405");
        if(key==="cmi.core.exit"&&["","time-out","suspend","logout"].indexOf(value)===-1)return fail("405");
        if((key==="cmi.suspend_data"&&value.length>4096)||(key==="cmi.core.lesson_location"&&value.length>255))return fail("405");
        if(key.indexOf("cmi.core.score.")===0&&value!==""&&(!/^-?\\d+(?:\\.\\d+)?$/.test(value)||Math.abs(Number(value))>1000000))return fail("405");
        if(key==="cmi.core.session_time"&&!/^\\d{2,4}:[0-5]\\d:[0-5]\\d(?:\\.\\d{1,2})?$/.test(value))return fail("405");
        data[key]=value;parent.postMessage({type:"athenemy:scorm:dirty",channel:config.channel},config.parentOrigin);error="0";return "true";
      },
      LMSCommit:function(arg){if(arg!=="")return fail("201");if(!initialized||finished)return fail("301");return commit(false);},
      LMSGetLastError:function(){return error;},
      LMSGetErrorString:function(code){return {"0":"No error","101":"General exception","201":"Invalid argument","301":"Not initialized","401":"Not implemented","403":"Read only","405":"Incorrect data type"}[code]||"Unknown error";},
      LMSGetDiagnostic:function(code){return this.LMSGetErrorString(code||error);}
    };
    window.addEventListener("message",function(event){if(event.source===parent&&event.origin===config.parentOrigin&&event.data&&event.data.type==="athenemy:scorm:saved"&&event.data.channel===config.channel){if(!event.data.ok)error="101";}});
    window.addEventListener("pagehide",function(){if(initialized&&!finished)commit(false);});
    setInterval(function(){if(initialized&&!finished)commit(false);},30000);
  })();</script>`;
}
