import { apiScopes } from "@/lib/developer/api-keys";
import { webhookEventTypes } from "@/lib/developer/webhooks";

export const apiVersion = "2026-05-17" as const;

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message", "requestId"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        requestId: { type: "string" },
      },
    },
  },
};

const pageInfoSchema = {
  type: "object",
  required: ["hasMore", "nextCursor"],
  properties: {
    hasMore: { type: "boolean" },
    nextCursor: { type: ["string", "null"] },
  },
};

const courseSummarySchema = {
  type: "object",
  required: ["id", "title", "slug", "status"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    slug: { type: "string" },
    subtitle: { type: ["string", "null"] },
    status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
    priceCents: { type: "integer" },
    currency: { type: "string" },
    requiredForMembers: { type: "boolean" },
    autoEnrollFutureMembers: { type: "boolean" },
    sourceTemplateId: { type: ["string", "null"] },
    sourceTemplateVersion: { type: ["integer", "null"] },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const enrollmentSchema = {
  type: "object",
  required: ["id", "userId", "courseId", "status", "createdAt"],
  properties: {
    id: { type: "string" },
    userId: { type: "string" },
    courseId: { type: "string" },
    status: {
      type: "string",
      enum: ["ACTIVE", "COMPLETED", "REFUNDED", "CANCELLED"],
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const certificateSchema = {
  type: "object",
  required: ["id", "certificateNumber", "userId", "courseId", "issuedAt"],
  properties: {
    id: { type: "string" },
    certificateNumber: { type: "string" },
    userId: { type: "string" },
    courseId: { type: "string" },
    issuedAt: { type: "string", format: "date-time" },
  },
};

function listResponse(itemSchemaRef: string) {
  return {
    type: "object",
    required: ["data", "pageInfo"],
    properties: {
      data: { type: "array", items: { $ref: itemSchemaRef } },
      pageInfo: { $ref: "#/components/schemas/PageInfo" },
    },
  };
}

function jsonContent(schema: object) {
  return { "application/json": { schema } };
}

const standardErrors = {
  "401": {
    description: "API key missing or invalid",
    content: jsonContent({ $ref: "#/components/schemas/Error" }),
  },
  "403": {
    description: "API key lacks the required scope",
    content: jsonContent({ $ref: "#/components/schemas/Error" }),
  },
  "404": {
    description: "Resource not found in this organisation",
    content: jsonContent({ $ref: "#/components/schemas/Error" }),
  },
};

const paginationParams = [
  {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
  },
  { name: "cursor", in: "query", schema: { type: "string" } },
];

export function buildOpenApiSpec(input: { baseUrl: string }) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Athenemy API",
      version: apiVersion,
      description:
        "Organisation-scoped REST API for Athenemy. Authenticate with `Authorization: Bearer ath_...`. Responses include an `x-request-id` header and errors follow the shape `{ error: { code, message, requestId } }`.",
    },
    servers: [{ url: `${input.baseUrl}/api/v1`, description: "Production" }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Identity" },
      { name: "Courses" },
      { name: "Enrollments" },
      { name: "Progress" },
      { name: "Certificates" },
      { name: "Portal" },
      { name: "Webhooks" },
    ],
    paths: {
      "/me": {
        get: {
          tags: ["Identity"],
          summary: "Identify the API key and organisation",
          description: `Requires the \`org:read\` scope.`,
          security: [{ bearerAuth: ["org:read"] }],
          responses: {
            "200": {
              description: "API key and organisation context",
              content: jsonContent({
                type: "object",
                properties: {
                  apiKey: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      scopes: {
                        type: "array",
                        items: { type: "string", enum: apiScopes as readonly string[] },
                      },
                    },
                  },
                  organization: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      slug: { type: "string" },
                      supportEmail: { type: ["string", "null"] },
                    },
                  },
                },
              }),
            },
            ...standardErrors,
          },
        },
      },
      "/courses": {
        get: {
          tags: ["Courses"],
          summary: "List courses in the organisation",
          security: [{ bearerAuth: ["courses:read"] }],
          parameters: [
            ...paginationParams,
            {
              name: "status",
              in: "query",
              schema: { type: "string", enum: ["draft"] },
            },
          ],
          responses: {
            "200": {
              description: "Paginated list of courses",
              content: jsonContent(listResponse("#/components/schemas/Course")),
            },
            ...standardErrors,
          },
        },
      },
      "/courses/{courseId}": {
        get: {
          tags: ["Courses"],
          summary: "Get a course with sections, lessons, and assessments",
          security: [{ bearerAuth: ["courses:read"] }],
          parameters: [
            {
              name: "courseId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Course detail",
              content: jsonContent({
                type: "object",
                properties: { data: { $ref: "#/components/schemas/Course" } },
              }),
            },
            ...standardErrors,
          },
        },
      },
      "/enrollments": {
        get: {
          tags: ["Enrollments"],
          summary: "List enrollments",
          security: [{ bearerAuth: ["enrollments:read"] }],
          parameters: [
            ...paginationParams,
            { name: "userId", in: "query", schema: { type: "string" } },
            { name: "courseId", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Paginated list of enrollments",
              content: jsonContent(
                listResponse("#/components/schemas/Enrollment"),
              ),
            },
            ...standardErrors,
          },
        },
        post: {
          tags: ["Enrollments"],
          summary: "Enroll a user in a course",
          description:
            "Naturally idempotent: repeating the same `userId`+`courseId` returns the existing ACTIVE enrollment. Pass an `Idempotency-Key` header to deduplicate the learning event emitted on the first attempt.",
          security: [{ bearerAuth: ["enrollments:write"] }],
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: false,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              required: ["courseId"],
              properties: {
                courseId: { type: "string" },
                userId: { type: "string" },
                email: { type: "string", format: "email" },
              },
            }),
          },
          responses: {
            "201": {
              description: "Enrollment created or reactivated",
              content: jsonContent({
                type: "object",
                properties: { data: { $ref: "#/components/schemas/Enrollment" } },
              }),
            },
            "400": {
              description: "Missing courseId or user identifier",
              content: jsonContent({ $ref: "#/components/schemas/Error" }),
            },
            ...standardErrors,
          },
        },
      },
      "/progress": {
        get: {
          tags: ["Progress"],
          summary: "List lesson progress",
          security: [{ bearerAuth: ["progress:read"] }],
          parameters: [
            { name: "userId", in: "query", schema: { type: "string" } },
            { name: "courseId", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Lesson progress for the organisation",
              content: jsonContent({
                type: "object",
                properties: {
                  data: { type: "array", items: { type: "object" } },
                },
              }),
            },
            ...standardErrors,
          },
        },
      },
      "/certificates": {
        get: {
          tags: ["Certificates"],
          summary: "List certificates",
          security: [{ bearerAuth: ["certificates:read"] }],
          parameters: [
            ...paginationParams,
            { name: "userId", in: "query", schema: { type: "string" } },
            { name: "courseId", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Paginated list of certificates",
              content: jsonContent(
                listResponse("#/components/schemas/Certificate"),
              ),
            },
            ...standardErrors,
          },
        },
      },
      "/certificates/{certificateId}": {
        get: {
          tags: ["Certificates"],
          summary: "Get one certificate",
          security: [{ bearerAuth: ["certificates:read"] }],
          parameters: [
            {
              name: "certificateId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Certificate",
              content: jsonContent({
                type: "object",
                properties: {
                  data: { $ref: "#/components/schemas/Certificate" },
                },
              }),
            },
            ...standardErrors,
          },
        },
      },
      "/portal/courses": {
        get: {
          tags: ["Portal"],
          summary: "List published courses for portal/marketing surfaces",
          security: [{ bearerAuth: ["courses:read"] }],
          responses: {
            "200": {
              description: "Published catalogue",
              content: jsonContent({
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Course" },
                  },
                },
              }),
            },
            ...standardErrors,
          },
        },
      },
      "/webhook-endpoints": {
        get: {
          tags: ["Webhooks"],
          summary: "List webhook endpoints",
          security: [{ bearerAuth: ["webhooks:read"] }],
          responses: {
            "200": {
              description: "Endpoints and event catalogue",
              content: jsonContent({
                type: "object",
                properties: {
                  data: { type: "array", items: { type: "object" } },
                  eventTypes: { type: "array", items: { type: "string" } },
                },
              }),
            },
            ...standardErrors,
          },
        },
        post: {
          tags: ["Webhooks"],
          summary: "Create a webhook endpoint",
          security: [{ bearerAuth: ["webhooks:write"] }],
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              required: ["url"],
              properties: {
                url: { type: "string", format: "uri" },
                eventTypes: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: webhookEventTypes as readonly string[],
                  },
                },
              },
            }),
          },
          responses: {
            "201": {
              description: "Endpoint with one-time signing secret",
              content: jsonContent({
                type: "object",
                properties: {
                  data: { type: "object" },
                  secret: { type: "string" },
                },
              }),
            },
            ...standardErrors,
          },
        },
      },
      "/webhook-endpoints/{endpointId}": {
        patch: {
          tags: ["Webhooks"],
          summary: "Update a webhook endpoint",
          security: [{ bearerAuth: ["webhooks:write"] }],
          parameters: [
            {
              name: "endpointId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Updated endpoint" },
            ...standardErrors,
          },
        },
        delete: {
          tags: ["Webhooks"],
          summary: "Delete a webhook endpoint",
          security: [{ bearerAuth: ["webhooks:write"] }],
          parameters: [
            {
              name: "endpointId",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "Deletion confirmation" },
            ...standardErrors,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "ath_<random>",
          description: `Organisation-scoped API key. Available scopes: ${apiScopes.join(", ")}.`,
        },
      },
      schemas: {
        Error: errorSchema,
        PageInfo: pageInfoSchema,
        Course: courseSummarySchema,
        Enrollment: enrollmentSchema,
        Certificate: certificateSchema,
      },
    },
  };
}
