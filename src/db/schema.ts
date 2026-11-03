import {
  pgTable,
  text,
  timestamp,
  numeric,
  jsonb,
  integer,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  createdAt: createdAt(),
});

export type Role = "owner" | "admin" | "member";

export const memberships = pgTable(
  "memberships",
  {
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.userId] }),
    index("memberships_user_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 hash of the session token. The raw token only lives in the cookie.
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orgId: text("org_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const invites = pgTable(
  "invites",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull().default("member"),
    tokenHash: text("token_hash").notNull(),
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invites_token_idx").on(t.tokenHash)],
);

// Simple fixed-window rate limiting (login, signup).
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const folders = pgTable(
  "folders",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("folders_org_parent_idx").on(t.orgId, t.parentId)],
);

export const items = pgTable(
  "items",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    folderId: text("folder_id"),
    name: text("name").notNull(),
    sku: text("sku"),
    barcode: text("barcode"),
    quantity: numeric("quantity", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    unit: text("unit"),
    minQuantity: numeric("min_quantity", { precision: 14, scale: 3 }),
    price: numeric("price", { precision: 14, scale: 2 }),
    notes: text("notes"),
    tags: text("tags").array().notNull().default([]),
    customFields: jsonb("custom_fields")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    // Soft delete: items go to the trash first so nothing is lost by accident.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("items_org_folder_idx").on(t.orgId, t.folderId),
    index("items_org_barcode_idx").on(t.orgId, t.barcode),
  ],
);

export const itemPhotos = pgTable(
  "item_photos",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("item_photos_item_idx").on(t.itemId)],
);

export type ActivityType =
  | "item.created"
  | "item.updated"
  | "item.quantity"
  | "item.moved"
  | "item.deleted"
  | "item.restored"
  | "item.imported"
  | "folder.created"
  | "folder.renamed"
  | "folder.deleted";

export const activity = pgTable(
  "activity",
  {
    id: id(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").$type<ActivityType>().notNull(),
    itemId: text("item_id"),
    folderId: text("folder_id"),
    // Denormalized so history stays readable after an item is deleted.
    itemName: text("item_name"),
    quantityBefore: numeric("quantity_before", { precision: 14, scale: 3 }),
    quantityAfter: numeric("quantity_after", { precision: 14, scale: 3 }),
    note: text("note"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_org_created_idx").on(t.orgId, t.createdAt),
    index("activity_item_idx").on(t.itemId),
  ],
);

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type Item = typeof items.$inferSelect;
export type ItemPhoto = typeof itemPhotos.$inferSelect;
export type Activity = typeof activity.$inferSelect;
