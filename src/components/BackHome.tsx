import Link from "next/link";

export function BackHome() {
  return (
    <p className="back-row">
      <Link href="/">Back to home</Link>
    </p>
  );
}
