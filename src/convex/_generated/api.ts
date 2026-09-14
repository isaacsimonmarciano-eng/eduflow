/* eslint-disable */
/**
 * Build-safe Convex API bridge.
 * Convex codegen may overwrite this file in configured development environments.
 */
import { anyApi, componentsGeneric } from "convex/server";

export const api = anyApi;
export const internal = anyApi;
export const components = componentsGeneric();
