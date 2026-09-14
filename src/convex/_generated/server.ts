/* eslint-disable */
/**
 * Build-safe Convex server bindings.
 * Convex codegen may overwrite this file in configured development environments.
 */
import {
  actionGeneric,
  httpActionGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import type { DataModel } from "./dataModel";

export const query = queryGeneric<DataModel>;
export const mutation = mutationGeneric<DataModel>;
export const action = actionGeneric;
export const internalQuery = internalQueryGeneric<DataModel>;
export const internalMutation = internalMutationGeneric<DataModel>;
export const internalAction = internalActionGeneric;
export const httpAction = httpActionGeneric;
