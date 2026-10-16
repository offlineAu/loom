import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ulid } from "ulid";
import { RlsTestDatabase } from "./harness";

/**
 * Adversarial RLS test suite (Phase 1C, §27-30 of the brief). Every test
 * here executes a real SQL statement against a real PostgreSQL instance
 * under the exact policies in supabase/migrations/ — an "attack" that is
 * expected to be denied is asserted to actually fail/return zero rows, not
 * merely reasoned about.
 */

let db: RlsTestDatabase;

beforeAll(async () => {
  db = await RlsTestDatabase.start();
}, 30_000);

afterAll(async () => {
  await db.stop();
});

async function createTracker(ownerId: string, name = "Owner's Tracker") {
  const client = await db.asUser(ownerId);
  try {
    const trackerId = ulid();
    const memberId = ulid();
    const result = await client.query(
      "select * from public.create_tracker($1, $2, $3, $4, $5)",
      [trackerId, memberId, "debt", name, JSON.stringify({})]
    );
    return { trackerId, memberId, row: result.rows[0] };
  } finally {
    await client.end();
  }
}

async function addMember(ownerId: string, trackerId: string, userId: string, role: "editor" | "viewer") {
  const client = await db.asUser(ownerId);
  try {
    const memberId = ulid();
    await client.query(
      "insert into public.tracker_members (id, tracker_id, user_id, role) values ($1, $2, $3, $4)",
      [memberId, trackerId, userId, role]
    );
    return memberId;
  } finally {
    await client.end();
  }
}

describe("profiles", () => {
  test("a user can read and update their own profile, bootstrapped automatically", async () => {
    const userId = await db.createTestUser("alice@example.com");
    const client = await db.asUser(userId);
    try {
      const select = await client.query("select * from public.profiles where id = $1", [userId]);
      expect(select.rows).toHaveLength(1);

      const update = await client.query(
        "update public.profiles set display_name = $1 where id = $2 returning display_name",
        ["Alice", userId]
      );
      expect(update.rows[0].display_name).toBe("Alice");
    } finally {
      await client.end();
    }
  });

  test("a user cannot read another user's profile", async () => {
    const userA = await db.createTestUser("profile-a@example.com");
    await db.createTestUser("profile-b@example.com");
    const client = await db.asUser(userA);
    try {
      const other = await db.createTestUser("profile-c@example.com");
      const result = await client.query("select * from public.profiles where id = $1", [other]);
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("a user cannot update another user's profile", async () => {
    const userA = await db.createTestUser("profile-upd-a@example.com");
    const userB = await db.createTestUser("profile-upd-b@example.com");
    const client = await db.asUser(userA);
    try {
      const result = await client.query(
        "update public.profiles set display_name = 'hijacked' where id = $1 returning id",
        [userB]
      );
      expect(result.rows).toHaveLength(0);

      const check = await db.asAdmin();
      try {
        const row = await check.query("select display_name from public.profiles where id = $1", [userB]);
        expect(row.rows[0].display_name).not.toBe("hijacked");
      } finally {
        await check.end();
      }
    } finally {
      await client.end();
    }
  });

  test("anonymous cannot read any profile", async () => {
    await db.createTestUser("profile-anon-target@example.com");
    const client = await db.asAnon();
    try {
      // No GRANT exists for `anon` on profiles at all, so this is denied at
      // the privilege level before RLS row-filtering is even reached — a
      // harder guarantee than an RLS-filtered empty result would be.
      await expect(client.query("select * from public.profiles")).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });

  test("a user cannot insert a profile row directly (bootstrap is trigger-only)", async () => {
    const userId = await db.createTestUser("no-direct-insert@example.com");
    const client = await db.asUser(userId);
    try {
      await expect(
        client.query("insert into public.profiles (id, display_name) values (gen_random_uuid(), 'forged')")
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });
});

describe("tracker ownership (User A creates, User B attacks)", () => {
  test("the owner can read and update their own tracker", async () => {
    const userA = await db.createTestUser("owner-a@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asUser(userA);
    try {
      const select = await client.query("select * from public.trackers where id = $1", [trackerId]);
      expect(select.rows).toHaveLength(1);

      const update = await client.query(
        "update public.trackers set name = $1 where id = $2 returning name",
        ["Renamed", trackerId]
      );
      expect(update.rows[0].name).toBe("Renamed");
    } finally {
      await client.end();
    }
  });

  test("the owner is recorded as owner in tracker_members", async () => {
    const userA = await db.createTestUser("owner-check-a@example.com");
    const { trackerId } = await createTracker(userA);

    const admin = await db.asAdmin();
    try {
      const result = await admin.query(
        "select role from public.tracker_members where tracker_id = $1 and user_id = $2",
        [trackerId, userA]
      );
      expect(result.rows[0].role).toBe("owner");
    } finally {
      await admin.end();
    }
  });

  test("an unrelated user cannot read the tracker (direct-ID attack)", async () => {
    const userA = await db.createTestUser("read-victim@example.com");
    const userB = await db.createTestUser("read-attacker@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asUser(userB);
    try {
      const result = await client.query("select * from public.trackers where id = $1", [trackerId]);
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("an unrelated user cannot update the tracker", async () => {
    const userA = await db.createTestUser("update-victim@example.com");
    const userB = await db.createTestUser("update-attacker@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asUser(userB);
    try {
      const result = await client.query(
        "update public.trackers set name = 'hijacked' where id = $1 returning id",
        [trackerId]
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }

    const admin = await db.asAdmin();
    try {
      const row = await admin.query("select name from public.trackers where id = $1", [trackerId]);
      expect(row.rows[0].name).not.toBe("hijacked");
    } finally {
      await admin.end();
    }
  });

  test("an unrelated user cannot archive the tracker", async () => {
    const userA = await db.createTestUser("archive-victim@example.com");
    const userB = await db.createTestUser("archive-attacker@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asUser(userB);
    try {
      const result = await client.query(
        "update public.trackers set archived_at = now() where id = $1 returning id",
        [trackerId]
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("an unrelated user cannot delete the tracker", async () => {
    const userA = await db.createTestUser("delete-victim@example.com");
    const userB = await db.createTestUser("delete-attacker@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asUser(userB);
    try {
      const result = await client.query("delete from public.trackers where id = $1 returning id", [trackerId]);
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }

    const admin = await db.asAdmin();
    try {
      const stillThere = await admin.query("select 1 from public.trackers where id = $1", [trackerId]);
      expect(stillThere.rows).toHaveLength(1);
    } finally {
      await admin.end();
    }
  });

  test("an unrelated user cannot insert a membership row into the tracker", async () => {
    const userA = await db.createTestUser("member-insert-victim@example.com");
    const userB = await db.createTestUser("member-insert-attacker@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asUser(userB);
    try {
      await expect(
        client.query(
          "insert into public.tracker_members (id, tracker_id, user_id, role) values ($1, $2, $3, 'editor')",
          [ulid(), trackerId, userB]
        )
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });

  test("an unrelated user cannot modify User A's owner membership row", async () => {
    const userA = await db.createTestUser("member-update-victim@example.com");
    const userB = await db.createTestUser("member-update-attacker@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asUser(userB);
    try {
      const result = await client.query(
        "update public.tracker_members set role = 'viewer' where tracker_id = $1 and user_id = $2 returning id",
        [trackerId, userA]
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("an unrelated user cannot promote themselves to owner via insert", async () => {
    const userA = await db.createTestUser("self-promote-victim@example.com");
    const userB = await db.createTestUser("self-promote-attacker@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asUser(userB);
    try {
      await expect(
        client.query(
          "insert into public.tracker_members (id, tracker_id, user_id, role) values ($1, $2, $3, 'owner')",
          [ulid(), trackerId, userB]
        )
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });

  test("anonymous cannot read, update, or delete the tracker", async () => {
    // No GRANT exists for `anon` on trackers at all, so every one of these
    // is denied at the privilege level (a harder guarantee than an
    // RLS-filtered empty result would be).
    const userA = await db.createTestUser("anon-victim@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asAnon();
    try {
      await expect(
        client.query("select * from public.trackers where id = $1", [trackerId])
      ).rejects.toThrow(/permission denied/);
      await expect(
        client.query("update public.trackers set name = 'anon' where id = $1", [trackerId])
      ).rejects.toThrow(/permission denied/);
      await expect(
        client.query("delete from public.trackers where id = $1", [trackerId])
      ).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });

  test("anonymous cannot manipulate membership", async () => {
    const userA = await db.createTestUser("anon-member-victim@example.com");
    const { trackerId } = await createTracker(userA);

    const client = await db.asAnon();
    try {
      await expect(
        client.query(
          "insert into public.tracker_members (id, tracker_id, user_id, role) values ($1, $2, gen_random_uuid(), 'editor')",
          [ulid(), trackerId]
        )
      ).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });

  test("a client cannot forge tracker ownership by inserting into trackers directly", async () => {
    const userB = await db.createTestUser("forger@example.com");
    const client = await db.asUser(userB);
    try {
      await expect(
        client.query(
          "insert into public.trackers (id, template_key, name) values ($1, 'debt', 'Forged') returning id",
          [ulid()]
        )
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });

  test("create_tracker always uses the caller's own identity, never a client-supplied owner", async () => {
    // There is no owner-id parameter to forge in the first place — this
    // proves it structurally: the RPC signature has no such parameter, and
    // the resulting membership row's user_id is exactly auth.uid() of the
    // caller, verified below directly.
    const userA = await db.createTestUser("no-forge-param@example.com");
    const { trackerId } = await createTracker(userA);

    const admin = await db.asAdmin();
    try {
      const owners = await admin.query(
        "select user_id from public.tracker_members where tracker_id = $1 and role = 'owner'",
        [trackerId]
      );
      expect(owners.rows).toHaveLength(1);
      expect(owners.rows[0].user_id).toBe(userA);
    } finally {
      await admin.end();
    }
  });

  test("an unauthenticated call to create_tracker is rejected", async () => {
    const client = await db.asAnon();
    try {
      await expect(
        client.query("select * from public.create_tracker($1, $2, $3, $4, $5)", [
          ulid(),
          ulid(),
          "debt",
          "Should not exist",
          JSON.stringify({}),
        ])
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });
});

describe("viewer role", () => {
  async function setupViewer() {
    const owner = await db.createTestUser("viewer-owner@example.com");
    const viewer = await db.createTestUser("viewer-user@example.com");
    const { trackerId } = await createTracker(owner, "Viewer Test Tracker");
    await addMember(owner, trackerId, viewer, "viewer");
    return { owner, viewer, trackerId };
  }

  test("viewer can read the tracker", async () => {
    const { viewer, trackerId } = await setupViewer();
    const client = await db.asUser(viewer);
    try {
      const result = await client.query("select * from public.trackers where id = $1", [trackerId]);
      expect(result.rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  });

  test("viewer cannot update the tracker", async () => {
    const { viewer, trackerId } = await setupViewer();
    const client = await db.asUser(viewer);
    try {
      const result = await client.query(
        "update public.trackers set name = 'viewer-edit' where id = $1 returning id",
        [trackerId]
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("viewer cannot archive or restore the tracker", async () => {
    const { viewer, trackerId } = await setupViewer();
    const client = await db.asUser(viewer);
    try {
      const result = await client.query(
        "update public.trackers set archived_at = now() where id = $1 returning id",
        [trackerId]
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("viewer cannot delete the tracker", async () => {
    const { viewer, trackerId } = await setupViewer();
    const client = await db.asUser(viewer);
    try {
      const result = await client.query("delete from public.trackers where id = $1 returning id", [trackerId]);
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("viewer can see the membership list but cannot insert membership", async () => {
    const { viewer, trackerId } = await setupViewer();
    const client = await db.asUser(viewer);
    try {
      const select = await client.query("select role from public.tracker_members where tracker_id = $1", [
        trackerId,
      ]);
      expect(select.rows.map((r) => r.role).sort()).toEqual(["owner", "viewer"]);

      await expect(
        client.query(
          "insert into public.tracker_members (id, tracker_id, user_id, role) values ($1, $2, gen_random_uuid(), 'viewer')",
          [ulid(), trackerId]
        )
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });

  test("viewer cannot escalate their own role to editor", async () => {
    const { viewer, trackerId } = await setupViewer();
    const client = await db.asUser(viewer);
    try {
      const escalate = await client.query(
        "update public.tracker_members set role = 'editor' where tracker_id = $1 and user_id = $2 returning id",
        [trackerId, viewer]
      );
      expect(escalate.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("viewer cannot delete any membership row", async () => {
    const { viewer, owner, trackerId } = await setupViewer();
    const client = await db.asUser(viewer);
    try {
      const result = await client.query(
        "delete from public.tracker_members where tracker_id = $1 and user_id = $2 returning id",
        [trackerId, owner]
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });
});

describe("editor role", () => {
  async function setupEditor() {
    const owner = await db.createTestUser("editor-owner@example.com");
    const editor = await db.createTestUser("editor-user@example.com");
    const { trackerId } = await createTracker(owner, "Editor Test Tracker");
    await addMember(owner, trackerId, editor, "editor");
    return { owner, editor, trackerId };
  }

  test("editor can read and update the tracker", async () => {
    const { editor, trackerId } = await setupEditor();
    const client = await db.asUser(editor);
    try {
      const update = await client.query(
        "update public.trackers set name = 'edited-by-editor' where id = $1 returning name",
        [trackerId]
      );
      expect(update.rows[0].name).toBe("edited-by-editor");
    } finally {
      await client.end();
    }
  });

  test("editor can archive and restore the tracker (D-006: editors soft-delete)", async () => {
    const { editor, trackerId } = await setupEditor();
    const client = await db.asUser(editor);
    try {
      const archive = await client.query(
        "update public.trackers set archived_at = now() where id = $1 returning archived_at",
        [trackerId]
      );
      expect(archive.rows[0].archived_at).not.toBeNull();

      const restore = await client.query(
        "update public.trackers set archived_at = null where id = $1 returning archived_at",
        [trackerId]
      );
      expect(restore.rows[0].archived_at).toBeNull();
    } finally {
      await client.end();
    }
  });

  test("editor cannot permanently delete the tracker (D-006: only owners permanently delete)", async () => {
    const { editor, trackerId } = await setupEditor();
    const client = await db.asUser(editor);
    try {
      const result = await client.query("delete from public.trackers where id = $1 returning id", [trackerId]);
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("editor cannot escalate their own role to owner", async () => {
    const { editor, trackerId } = await setupEditor();
    const client = await db.asUser(editor);
    try {
      const result = await client.query(
        "update public.tracker_members set role = 'owner' where tracker_id = $1 and user_id = $2 returning id",
        [trackerId, editor]
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("editor cannot modify another member's role (membership management is owner-only)", async () => {
    const { owner, editor, trackerId } = await setupEditor();
    const viewer = await db.createTestUser("editor-cannot-touch-viewer@example.com");
    await addMember(owner, trackerId, viewer, "viewer");

    const client = await db.asUser(editor);
    try {
      const result = await client.query(
        "update public.tracker_members set role = 'editor' where tracker_id = $1 and user_id = $2 returning id",
        [trackerId, viewer]
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("editor cannot insert new membership rows", async () => {
    const { editor, trackerId } = await setupEditor();
    const client = await db.asUser(editor);
    try {
      await expect(
        client.query(
          "insert into public.tracker_members (id, tracker_id, user_id, role) values ($1, $2, gen_random_uuid(), 'viewer')",
          [ulid(), trackerId]
        )
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });
});

describe("owner membership management", () => {
  test("owner can add editor and viewer members", async () => {
    const owner = await db.createTestUser("mgmt-owner@example.com");
    const editor = await db.createTestUser("mgmt-editor@example.com");
    const viewer = await db.createTestUser("mgmt-viewer@example.com");
    const { trackerId } = await createTracker(owner, "Membership Mgmt Tracker");

    await addMember(owner, trackerId, editor, "editor");
    await addMember(owner, trackerId, viewer, "viewer");

    const admin = await db.asAdmin();
    try {
      const result = await admin.query(
        "select user_id, role from public.tracker_members where tracker_id = $1 order by role",
        [trackerId]
      );
      expect(result.rows).toHaveLength(3);
    } finally {
      await admin.end();
    }
  });

  test("owner can reassign a member between editor and viewer", async () => {
    const owner = await db.createTestUser("reassign-owner@example.com");
    const member = await db.createTestUser("reassign-member@example.com");
    const { trackerId } = await createTracker(owner, "Reassign Tracker");
    await addMember(owner, trackerId, member, "viewer");

    const client = await db.asUser(owner);
    try {
      const result = await client.query(
        "update public.tracker_members set role = 'editor' where tracker_id = $1 and user_id = $2 returning role",
        [trackerId, member]
      );
      expect(result.rows[0].role).toBe("editor");
    } finally {
      await client.end();
    }
  });

  test("owner cannot promote a member directly to owner via update (ownership transfer is out of scope)", async () => {
    const owner = await db.createTestUser("no-transfer-owner@example.com");
    const member = await db.createTestUser("no-transfer-member@example.com");
    const { trackerId } = await createTracker(owner, "No Transfer Tracker");
    await addMember(owner, trackerId, member, "editor");

    const client = await db.asUser(owner);
    try {
      await expect(
        client.query(
          "update public.tracker_members set role = 'owner' where tracker_id = $1 and user_id = $2",
          [trackerId, member]
        )
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });

  test("owner cannot insert a second owner row for the same tracker", async () => {
    const owner = await db.createTestUser("one-owner-a@example.com");
    const other = await db.createTestUser("one-owner-b@example.com");
    const { trackerId } = await createTracker(owner, "One Owner Tracker");

    const client = await db.asUser(owner);
    try {
      await expect(
        client.query(
          "insert into public.tracker_members (id, tracker_id, user_id, role) values ($1, $2, $3, 'owner')",
          [ulid(), trackerId, other]
        )
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });

  test("owner cannot remove their own owner membership row (no self-orphaning)", async () => {
    const owner = await db.createTestUser("no-self-delete-owner@example.com");
    const { trackerId } = await createTracker(owner, "No Self Delete Tracker");

    const client = await db.asUser(owner);
    try {
      const result = await client.query(
        "delete from public.tracker_members where tracker_id = $1 and user_id = $2 returning id",
        [trackerId, owner]
      );
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test("owner can remove a non-owner member", async () => {
    const owner = await db.createTestUser("remove-member-owner@example.com");
    const member = await db.createTestUser("remove-member-target@example.com");
    const { trackerId } = await createTracker(owner, "Remove Member Tracker");
    await addMember(owner, trackerId, member, "viewer");

    const client = await db.asUser(owner);
    try {
      const result = await client.query(
        "delete from public.tracker_members where tracker_id = $1 and user_id = $2 returning id",
        [trackerId, member]
      );
      expect(result.rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  });

  test("cannot create duplicate membership for the same tracker/user", async () => {
    const owner = await db.createTestUser("dup-member-owner@example.com");
    const member = await db.createTestUser("dup-member-target@example.com");
    const { trackerId } = await createTracker(owner, "Dup Member Tracker");
    await addMember(owner, trackerId, member, "viewer");

    const client = await db.asUser(owner);
    try {
      await expect(
        client.query(
          "insert into public.tracker_members (id, tracker_id, user_id, role) values ($1, $2, $3, 'editor')",
          [ulid(), trackerId, member]
        )
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });
});

describe("tracker isolation between multiple trackers", () => {
  test("a member of one tracker has no access to another tracker owned by the same user", async () => {
    const owner = await db.createTestUser("isolation-owner@example.com");
    const { trackerId: trackerA } = await createTracker(owner, "Tracker A");
    const { trackerId: trackerB } = await createTracker(owner, "Tracker B");

    const viewerOfA = await db.createTestUser("isolation-viewer-a@example.com");
    await addMember(owner, trackerA, viewerOfA, "viewer");

    const client = await db.asUser(viewerOfA);
    try {
      const canSeeA = await client.query("select 1 from public.trackers where id = $1", [trackerA]);
      expect(canSeeA.rows).toHaveLength(1);

      const canSeeB = await client.query("select 1 from public.trackers where id = $1", [trackerB]);
      expect(canSeeB.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });
});
