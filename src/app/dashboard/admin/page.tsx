import { Users, BookOpen, ReceiptText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { label: "Users", value: "312", icon: Users },
  { label: "Courses", value: "18", icon: BookOpen },
  { label: "Enrollments", value: "1,024", icon: ShieldCheck },
  { label: "Payments", value: "$42k", icon: ReceiptText },
];

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-2 text-muted-foreground">
          Platform stats, users, courses, enrollments, role assignment, and
          recent payment events.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <stat.icon className="h-5 w-5 text-primary" />
              <CardTitle className="text-sm text-muted-foreground">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {["Admin Owner", "Instructor Demo", "Student Demo"].map((name, index) => (
            <div key={name} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">{name}</p>
                <p className="text-sm text-muted-foreground">
                  {name.toLowerCase().replaceAll(" ", ".")}@example.com
                </p>
              </div>
              <Badge variant={index === 0 ? "gold" : "outline"}>
                {index === 0 ? "ADMIN" : index === 1 ? "INSTRUCTOR" : "STUDENT"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
