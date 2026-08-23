// Health check de Render (SPEC.md §15.1). No toca la base de datos.

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, version: "1.0.0" });
}
