'use client';
import { createUsePuck, type PuckApi } from '@measured/puck';
export const useBuilderPuck: <T>(selector: (state: PuckApi) => T) => T = createUsePuck();
