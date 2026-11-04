// Apps Script has no timers. bcrypt's sync verifier never invokes this;
// providing the binding prevents its unused async scheduler from failing at load.
export function setTimeout() {
  throw new Error(
    "Asynchronous bcrypt is not supported in Apps Script. Use compareSync.",
  );
}
