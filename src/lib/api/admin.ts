import { PaginationService } from "@/lib/pagination";
import { IPaginationParams, IPaginationResult, User, Profile } from "@/types";

/**
 * getAdminData
 * ────────────
 * Récupère et mappe les données utilisateur et profil pour le panneau d'admin.
 * Supporte la pagination optionnelle.
 */
export async function getAdminData(
  userParams?: IPaginationParams,
  profileParams?: IPaginationParams
): Promise<{ 
  users: IPaginationResult<User>; 
  profiles: IPaginationResult<Profile> 
}> {
  try {
    const [userRes, profileRes] = await Promise.all([
      PaginationService.paginate("user", userParams, {
        where: { deletedAt: null },
        include: { profile: true },
        orderBy: { createdAt: "desc" },
      }),
      PaginationService.paginate("profile", profileParams, {
        include: { permissions: true },
        orderBy: { libelle: "asc" },
      }),
    ]);

    // Map to UI types
    const mappedUsers: User[] = userRes.data.map((u: any) => ({
      id: u.id,
      firstname: u.firstname || undefined,
      lastname: u.lastname || undefined,
      phoneNumber: u.phoneNumber || undefined,
      name: `${u.firstname || ""} ${u.lastname || ""}`.trim() || u.email.split("@")[0],
      email: u.email,
      role: u.profile?.libelle || "Collaborateur",
      active: u.status === "ACTIVE",
      lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("fr-FR") : "Jamais",
      avatar: (u.firstname?.[0] || u.lastname?.[0] || u.email[0]).toUpperCase() + (u.firstname?.[1] || u.lastname?.[1] || u.email[1] || "").toUpperCase()
    }));

    const mappedProfiles: Profile[] = profileRes.data.map((p: any) => ({
      id: p.id,
      libelle: p.libelle,
      label: p.libelle,
      color: p.libelle === "Administrateur" || p.libelle === "admin" ? "#d95565" : (p.libelle === "Opérateur" || p.libelle === "operator" ? "#d4a843" : "#7b84c9"),
      description: p.description || "Aucune description",
      permissions: p.permissions.map((pm: any) => pm.label || pm.libelle || pm)
    }));

    return { 
      users: { data: mappedUsers, metadata: userRes.metadata }, 
      profiles: { data: mappedProfiles, metadata: profileRes.metadata } 
    };
  } catch (error) {
    console.error("[getAdminData] Error:", error);
    throw error;
  }
}
