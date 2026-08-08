// Lets feature stores contribute extra data to the Google Drive payload
// without the board store importing them (which would create a cycle).

type ExtraGetter = () => Record<string, unknown>;
type ExtraApplier = (data: Record<string, unknown>) => void;

let getExtra: ExtraGetter = () => ({});
let applyExtra: ExtraApplier = () => {};

export const registerDriveExtra = (getter: ExtraGetter, applier: ExtraApplier): void => {
  getExtra = getter;
  applyExtra = applier;
};

export const collectDriveExtra = (): Record<string, unknown> => {
  try {
    return getExtra() || {};
  } catch (e) {
    console.warn('Drive extra collection failed', e);
    return {};
  }
};

export const applyDriveExtra = (data: Record<string, unknown>): void => {
  try {
    applyExtra(data || {});
  } catch (e) {
    console.warn('Drive extra apply failed', e);
  }
};
