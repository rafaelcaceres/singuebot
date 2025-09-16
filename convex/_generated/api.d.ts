/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as aiAgent from "../aiAgent.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as createAdminUser from "../createAdminUser.js";
import type * as debug from "../debug.js";
import type * as functions_admin_knowledge from "../functions/admin/knowledge.js";
import type * as functions_interview from "../functions/interview.js";
import type * as functions_rag from "../functions/rag.js";
import type * as functions_rag_actions from "../functions/rag_actions.js";
import type * as functions_twilio from "../functions/twilio.js";
import type * as functions_twilio_db from "../functions/twilio_db.js";
import type * as http from "../http.js";
import type * as router from "../router.js";
import type * as seed from "../seed.js";
import type * as whatsapp from "../whatsapp.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  aiAgent: typeof aiAgent;
  analytics: typeof analytics;
  auth: typeof auth;
  createAdminUser: typeof createAdminUser;
  debug: typeof debug;
  "functions/admin/knowledge": typeof functions_admin_knowledge;
  "functions/interview": typeof functions_interview;
  "functions/rag": typeof functions_rag;
  "functions/rag_actions": typeof functions_rag_actions;
  "functions/twilio": typeof functions_twilio;
  "functions/twilio_db": typeof functions_twilio_db;
  http: typeof http;
  router: typeof router;
  seed: typeof seed;
  whatsapp: typeof whatsapp;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
