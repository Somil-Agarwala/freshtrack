import type { UserRole } from "@/types";

/**
 * Who may do what. This is the ONE place to change a boundary: every
 * screen asks `can(role, action)` rather than checking roles itself.
 *
 *   Godown team (manager)  everything that happens on site: pickups,
 *                          counting, tying bags, sending runs, godown
 *                          damage, adding a new party or item mid-task.
 *   Admin                  additionally: recording factory payments,
 *                          final say on godown entries, deleting, prices
 *                          and master data, the owner dashboard and
 *                          exports, users and PINs.
 */
export type Action =
  | "pickupCount" // log pickups, count bags, log godown damage
  | "tieSend" // close part-filled bags, send runs to the factory
  | "addParty" // add a new party during a pickup
  | "addProduct" // add a new item while counting
  | "recordPayment" // enter what the factory paid
  | "reviewGodown" // set a godown entry's final status
  | "delete" // delete pickups or entries
  | "editMaster" // edit companies, product prices, parties
  | "ownerView" // owner dashboard, detailed reports, Excel exports
  | "manageUsers"; // add users, reset PINs

const PERMISSIONS: Record<UserRole, Action[]> = {
  admin: ["pickupCount", "tieSend", "addParty", "addProduct", "recordPayment", "reviewGodown", "delete", "editMaster", "ownerView", "manageUsers"],
  manager: ["pickupCount", "tieSend", "addParty", "addProduct"],
  data_entry: ["pickupCount", "addParty", "addProduct"],
  viewer: [],
};

export function can(role: UserRole | undefined, action: Action): boolean {
  return !!role && PERMISSIONS[role].includes(action);
}

/** Pages that need a permission to open. Everything else anyone can view. */
const ROUTES: [RegExp, Action][] = [
  [/^\/dashboard/, "ownerView"],
  [/^\/analytics/, "ownerView"],
  [/^\/users/, "manageUsers"],
  [/^\/master-data\/companies/, "editMaster"],
  [/^\/pickup/, "pickupCount"],
  [/^\/count\/.+/, "pickupCount"],
  [/^\/godown\/new/, "pickupCount"],
  [/^\/piles\/tied/, "tieSend"],
];

export function canVisit(role: UserRole | undefined, pathname: string): boolean {
  const rule = ROUTES.find(([re]) => re.test(pathname));
  return !rule || can(role, rule[1]);
}
