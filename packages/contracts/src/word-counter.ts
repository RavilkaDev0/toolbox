import { wordCounterLimits } from "@toolbox/core";
import { z } from "zod";

export const wordCounterTextSchema = z.string().max(wordCounterLimits.maximumUtf16CodeUnits);
export type WordCounterTextInput = string;
