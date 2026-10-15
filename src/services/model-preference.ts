import { FREE_MODELS } from "../../functions/src/models.mjs";
const KEY = "caption:reading-model";
export const preferredModel = () => {
  try {
    const saved = localStorage.getItem(KEY);
    return FREE_MODELS.some((model) => model.id === saved)
      ? saved!
      : FREE_MODELS[0].id;
  } catch {
    return FREE_MODELS[0].id;
  }
};
export const keepModel = (model: string) => {
  try {
    localStorage.setItem(KEY, model);
  } catch {
    /* The current reading still uses the selected model. */
  }
};
