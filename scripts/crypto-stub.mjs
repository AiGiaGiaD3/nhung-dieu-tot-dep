export default {
  randomBytes() {
    throw new Error(
      "Server only verifies bcrypt; secret generation runs in Node.",
    );
  },
};
