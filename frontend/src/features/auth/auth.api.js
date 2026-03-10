import { googleLoginUser, loginUser, registerUser } from "../../api";

export async function loginWithEmail(payload) {
  return loginUser(payload);
}

export async function registerWithEmail(payload) {
  return registerUser(payload);
}

export async function continueWithGoogle(payload) {
  return googleLoginUser(payload);
}
