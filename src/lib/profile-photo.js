export async function attachProfilePhoto(storage, person) {
  delete person.avatarUrl;
  delete person.avatarError;
  if (!person.avatar_key) return person;
  try {
    const result = await storage
      .from("sikap-avatars")
      .createSignedUrl(person.avatar_key, 3600);
    if (result.error) throw result.error;
    if (!result.data?.signedUrl)
      throw Error("No private image URL was returned.");
    person.avatarUrl = result.data.signedUrl;
  } catch (error) {
    person.avatarError =
      "Your picture is saved, but cannot be displayed. " +
      (error.message || "Private storage access failed.");
  }
  return person;
}
