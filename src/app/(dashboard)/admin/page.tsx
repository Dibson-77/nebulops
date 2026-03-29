import { getAdminData } from "@/lib/api/admin";
import { AdminPanel } from "@/components/dashboard/AdminPanel";

/**
 * app/(dashboard)/admin/page.tsx
 * ──────────────────────────────
 * Panneau d'administration : Données réelles via Prisma (Server Side).
 */

export default async function AdminPage() {
  try {
    // Appel direct de la logique (pas de fetch HTTP sur soi-même) pour éviter ECONNREFUSED
    const data = await getAdminData();

    return (
      <AdminPanel users={data.users} profiles={data.profiles} />
    );
  } catch (err) {
    console.error("Failed to fetch admin data", err);
    return (
      <div style={{ background: "#d9556515", border: "1px solid #d9556533", borderRadius: "10px", padding: "28px", textAlign: "center" }}>
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>❌</div>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#d95565" }}>Erreur de connexion</div>
        <div style={{ fontSize: "12px", color: "#8891a0", marginTop: "4px" }}>
          Impossible de récupérer les données système. 
          Vérifiez les journaux du serveur pour plus de détails.
        </div>
      </div>
    );
  }
}
