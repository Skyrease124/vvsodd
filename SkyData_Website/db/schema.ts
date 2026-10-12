import { sqliteTable, text, integer, real, blob, index } from 'drizzle-orm/sqlite-core';
export const secrets = sqliteTable('secrets', { name: text('name').primaryKey(), ciphertext: text('ciphertext').notNull(), iv: text('iv').notNull() });

export const chatState = sqliteTable('chat_state', { owner: text('owner').primaryKey(), state: text('state').notNull() });

export const requestLimits = sqliteTable('request_limits', { id: text('id').primaryKey(), window: integer('window').notNull(), count: integer('count').notNull() });

export const projects = sqliteTable('projects', { id: text('id').primaryKey(), owner: text('owner').notNull(), name: text('name').notNull(), size: integer('size').notNull(), status: text('status').notNull(), upload: text('upload').notNull(), key: text('key').notNull(), chunks: integer('chunks').notNull(), created: integer('created').notNull() });
export const projectParts = sqliteTable('project_parts', { id: text('id').primaryKey(), project: text('project').notNull(), number: integer('number').notNull(), etag: text('etag').notNull() });

export const siteAdmin=sqliteTable('site_admin',{id:text('id').primaryKey(),owner:text('owner').notNull()});

export const members=sqliteTable('members',{email:text('email').primaryKey(),userId:text('user_id').unique(),status:text('status').notNull(),passwordHash:text('password_hash'),passwordSalt:text('password_salt'),created:integer('created').notNull(),lastSeen:integer('last_seen'),dailyLimit:integer('daily_limit').notNull().default(100),usagePaused:integer('usage_paused').notNull().default(0)});
export const memberSessions=sqliteTable('member_sessions',{tokenHash:text('token_hash').primaryKey(),email:text('email').notNull(),expires:integer('expires').notNull()});

export const dailyAllowance=sqliteTable('daily_allowance',{id:text('id').primaryKey(),email:text('email').notNull(),day:text('day').notNull(),used:integer('used').notNull()});

export const blenderPairing=sqliteTable('blender_pairing',{owner:text('owner').primaryKey(),codeHash:text('code_hash').notNull().unique(),expires:integer('expires').notNull()});
export const blenderDevice=sqliteTable('blender_device',{owner:text('owner').primaryKey(),id:text('id').notNull().unique(),tokenHash:text('token_hash').notNull().unique(),name:text('name').notNull(),created:integer('created').notNull(),lastSeen:integer('last_seen'),blenderReady:integer('blender_ready').notNull().default(0),protocolVersion:integer('protocol_version').notNull().default(1)});
export const blenderSceneRequest=sqliteTable('blender_scene_request',{owner:text('owner').primaryKey(),id:text('id').notNull().unique(),deviceId:text('device_id').notNull(),created:integer('created').notNull(),expires:integer('expires').notNull(),status:text('status').notNull(),completed:integer('completed'),snapshot:text('snapshot')});
export const blenderCommand=sqliteTable('blender_command',{owner:text('owner').primaryKey(),id:text('id').notNull().unique(),deviceId:text('device_id').notNull(),created:integer('created').notNull(),expires:integer('expires').notNull(),status:text('status').notNull(),prompt:text('prompt').notNull(),plan:text('plan'),completed:integer('completed'),message:text('message')});


export const knowledgeDocuments=sqliteTable('knowledge_documents',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),name:text('name').notNull(),size:integer('size').notNull(),kind:text('kind').notNull(),category:text('category').notNull(),status:text('status').notNull(),key:text('key').notNull(),upload:text('upload').notNull(),nextBatch:integer('next_batch').notNull().default(0),units:integer('units').notNull().default(0),chunks:integer('chunks').notNull().default(0),indexed:integer('indexed').notNull().default(0),emptyUnits:integer('empty_units').notNull().default(0),error:text('error'),enabled:integer('enabled').notNull().default(1),review:text('review').notNull().default('unreviewed'),created:integer('created').notNull(),updated:integer('updated').notNull(),lease:text('lease'),leaseUntil:integer('lease_until').notNull().default(0),attempts:integer('attempts').notNull().default(0),retryAt:integer('retry_at').notNull().default(0),metadata:text('metadata').notNull().default('{}')
},t=>[index('knowledge_documents_owner_status').on(t.owner,t.status)]);
export const knowledgeParts=sqliteTable('knowledge_parts',{id:text('id').primaryKey(),document:text('document').notNull().references(()=>knowledgeDocuments.id,{onDelete:'cascade'}),number:integer('number').notNull(),etag:text('etag').notNull()});
export const knowledgeBatches=sqliteTable('knowledge_batches',{id:text('id').primaryKey(),document:text('document').notNull().references(()=>knowledgeDocuments.id,{onDelete:'cascade'}),number:integer('number').notNull(),hash:text('hash').notNull()});
export const knowledgeChunks=sqliteTable('knowledge_chunks',{
 id:text('id').primaryKey(),document:text('document').notNull().references(()=>knowledgeDocuments.id,{onDelete:'cascade'}),owner:text('owner').notNull(),ordinal:integer('ordinal').notNull(),page:integer('page'),pageIndex:integer('page_index'),pageEnd:integer('page_end'),pageLabel:text('page_label'),printedPage:text('printed_page'),locationStatus:text('location_status').notNull().default('legacy'),section:text('section').notNull(),content:text('content').notNull(),hash:text('hash').notNull(),vector:blob('vector',{mode:'buffer'}),model:text('model'),created:integer('created').notNull()
},t=>[index('knowledge_chunks_document_ordinal').on(t.document,t.ordinal),index('knowledge_chunks_owner').on(t.owner)]);
export const knowledgeBuckets=sqliteTable('knowledge_buckets',{id:text('id').primaryKey(),owner:text('owner').notNull(),bucket:text('bucket').notNull(),chunk:text('chunk').notNull().references(()=>knowledgeChunks.id,{onDelete:'cascade'})},t=>[index('knowledge_buckets_lookup').on(t.owner,t.bucket)]);
export const knowledgeTerms=sqliteTable('knowledge_terms',{id:text('id').primaryKey(),owner:text('owner').notNull(),term:text('term').notNull(),chunk:text('chunk').notNull().references(()=>knowledgeChunks.id,{onDelete:'cascade'})},t=>[index('knowledge_terms_lookup').on(t.owner,t.term)]);

export const pollySettings=sqliteTable('polly_settings',{id:text('id').primaryKey(),value:text('value').notNull()});
export const pollyMonths=sqliteTable('polly_months',{month:text('month').primaryKey(),characters:integer('characters').notNull().default(0),requests:integer('requests').notNull().default(0),estimatedCost:real('estimated_cost').notNull().default(0),unpricedCharacters:integer('unpriced_characters').notNull().default(0)});
export const pollyActivity=sqliteTable('polly_activity',{id:text('id').primaryKey(),created:integer('created').notNull(),engine:text('engine').notNull(),voice:text('voice').notNull(),characters:integer('characters').notNull(),estimatedCost:real('estimated_cost'),status:text('status').notNull(),code:text('code')},t=>[index('polly_activity_created').on(t.created)]);
export const pollyLeases=sqliteTable('polly_leases',{id:text('id').primaryKey(),expires:integer('expires').notNull()});

export const aiRouterSettings=sqliteTable('ai_router_settings',{id:text('id').primaryKey(),value:text('value').notNull()});
export const aiProviderCatalog=sqliteTable('ai_provider_catalog',{provider:text('provider').primaryKey(),checked:integer('checked').notNull(),status:text('status').notNull(),models:text('models').notNull()});
export const aiRouterBudget=sqliteTable('ai_router_budget',{day:text('day').primaryKey(),count:integer('count').notNull()});
export const aiRouterUsage=sqliteTable('ai_router_usage',{id:text('id').primaryKey(),day:text('day').notNull(),provider:text('provider').notNull(),model:text('model').notNull(),task:text('task').notNull(),status:integer('status').notNull(),latency:integer('latency').notNull(),inputTokens:integer('input_tokens'),outputTokens:integer('output_tokens')},t=>[index('ai_router_usage_day').on(t.day)]);
