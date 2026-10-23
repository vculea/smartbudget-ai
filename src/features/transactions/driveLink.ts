/** Linkurile din Drive se deschid doar dacă sunt https, ca un URL ciudat din răspuns să nu devină un `javascript:`. */
export function isDriveLink(url: string | null | undefined): url is string {
  return typeof url === "string" && url.startsWith("https://");
}
