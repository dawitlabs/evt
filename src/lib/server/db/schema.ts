import { pgTable, serial, integer, text, uuid, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	telegramId: text('telegram_id').notNull().unique(),
	username: text('username'),
	firstName: text('first_name'),
	photoUrl: text('photo_url'),
	publicKey: text('public_key'),
	encryptedPrivateKey: text('encrypted_private_key'),
	privateKeySalt: text('private_key_salt'),
	privateKeyNonce: text('private_key_nonce'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const sessions = pgTable('sessions', {
	id: uuid('id').primaryKey().defaultRandom(),
	token: text('token').notNull().unique(),
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const events = pgTable('events', {
	id: uuid('id').primaryKey().defaultRandom(),
	creatorId: uuid('creator_id')
		.notNull()
		.references(() => users.id),
	ciphertext: text('ciphertext').notNull(),
	nonce: text('nonce').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const telegramLoginTokens = pgTable('telegram_login_tokens', {
	token: text('token').primaryKey(),
	status: text('status', { enum: ['pending', 'verified'] })
		.notNull()
		.default('pending'),
	telegramId: text('telegram_id'),
	username: text('username'),
	firstName: text('first_name'),
	photoUrl: text('photo_url'),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export const eventsKeys = pgTable(
	'event_keys',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		wrappedKey: text('wrapped_key').notNull(),
		role: text('role', { enum: ['owner', 'coorganizer', 'attendee'] })
			.notNull()
			.default('attendee'),
		invitedBy: uuid('invited_by').references(() => users.id),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [uniqueIndex('event_keys_event_user_idx').on(table.eventId, table.userId)]
);

export const pendingInvites = pgTable(
	'pending_invites',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		eventId: uuid('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		telegramUsername: text('telegram_username').notNull(),
		role: text('role', { enum: ['coorganizer', 'attendee'] })
			.notNull()
			.default('attendee'),
		invitedBy: uuid('invited_by')
			.notNull()
			.references(() => users.id),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [uniqueIndex('pending_invites_event_username_idx').on(table.eventId, table.telegramUsername)]
);
