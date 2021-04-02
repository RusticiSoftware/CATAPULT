/*
    Copyright 2021 Rustici Software

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
const tableName = "sessions";

exports.up = (knex) => knex.schema.createTable(
    tableName,
    (table) => {
        table.increments("id");
        table.timestamps(true, true);
        table.integer("tenant_id").unsigned().notNullable().references("id").inTable("tenants").onUpdate("CASCADE").onDelete("RESTRICT");
        table.integer("registration_id").unsigned().notNullable().references("id").inTable("registrations").onUpdate("CASCADE").onDelete("CASCADE");
        table.datetime("last_request_time");
        table.enu("launch_mode", ["Normal", "Browse", "Review"]).notNullable();
        table.uuid("launch_token_id").notNullable();
        table.boolean("launch_token_fetched").notNullable().default(false);
        table.boolean("is_launched").notNullable().default(false);
        table.boolean("is_initialized").notNullable().default(false);
        table.boolean("is_terminated").notNullable().default(false);
        table.boolean("is_failed").notNullable().default(false);
        table.bigInteger("time_reported");
    }
);
exports.down = (knex) => knex.schema.dropTable(tableName);
