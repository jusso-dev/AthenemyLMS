import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiScopes } from "@/lib/developer/api-keys";
import { apiVersion } from "@/lib/developer/openapi";
import { webhookEventTypes } from "@/lib/developer/webhooks";
import { env } from "@/lib/env";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-5">
      <code>{children}</code>
    </pre>
  );
}

export default function DeveloperDocsPage() {
  const baseUrl = env.NEXT_PUBLIC_APP_URL || "https://your-instance.example.com";
  const apiBase = `${baseUrl}/api/v1`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="API documentation"
        description={`REST API for Athenemy, version ${apiVersion}. All endpoints are organisation-scoped.`}
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/developer">
              <ArrowLeft className="h-4 w-4" />
              Developer
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Create an API key in the Developer dashboard. Keys are shown once,
            stored hashed at rest, scoped to one organisation, and can be
            revoked at any time.
          </p>
          <p>
            Send the key as a bearer token on every request:
          </p>
          <CodeBlock>{`curl ${apiBase}/me \\
  -H "Authorization: Bearer ath_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scopes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Each key carries a list of capabilities checked on every call.</p>
          <div className="flex flex-wrap gap-2">
            {apiScopes.map((scope) => (
              <Badge key={scope} variant="outline">
                {scope}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Errors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Every error response has the same envelope. The{" "}
            <code>requestId</code> matches the <code>x-request-id</code> header
            and is useful when reporting issues.
          </p>
          <CodeBlock>{`{
  "error": {
    "code": "permission_denied",
    "message": "This API key requires the courses:read scope.",
    "requestId": "req_b4c2..."
  }
}`}</CodeBlock>
          <p>
            HTTP <code>401</code> means the bearer token was missing, revoked,
            or expired. <code>403</code> means the scope did not match.{" "}
            <code>404</code> means the resource does not belong to this
            organisation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagination</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            List endpoints accept <code>limit</code> (1-100, default 25) and{" "}
            <code>cursor</code> (the <code>nextCursor</code> from the previous
            response). Iterate until <code>hasMore</code> is <code>false</code>.
          </p>
          <CodeBlock>{`GET ${apiBase}/courses?limit=50

{
  "data": [/* ... */],
  "pageInfo": { "hasMore": true, "nextCursor": "cmw5..." }
}`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Idempotency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Write endpoints accept an <code>Idempotency-Key</code> header so
            retries do not produce duplicate side effects. <code>POST</code>{" "}
            <code>/enrollments</code> is also naturally idempotent on{" "}
            <code>(userId, courseId)</code>.
          </p>
          <CodeBlock>{`curl -X POST ${apiBase}/enrollments \\
  -H "Authorization: Bearer ath_..." \\
  -H "Idempotency-Key: cs-onboarding-2026-05-23-user-123" \\
  -H "content-type: application/json" \\
  -d '{ "courseId": "course_xxx", "email": "learner@example.com" }'`}</CodeBlock>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Subscribe a webhook endpoint to one or more of these event types in
            the Developer dashboard. Payloads share a common envelope with{" "}
            <code>id</code>, <code>type</code>, <code>createdAt</code>,{" "}
            <code>organizationId</code>, <code>data</code>, and{" "}
            <code>apiVersion</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            {webhookEventTypes.map((eventType) => (
              <Badge key={eventType} variant="outline">
                {eventType}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OpenAPI spec</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            The full machine-readable spec is served from{" "}
            <code>{`${apiBase}/openapi.json`}</code>. Import it into Postman,
            Bruno, or any OpenAPI tooling to generate clients.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/api/v1/openapi.json" target="_blank">
              View openapi.json
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
