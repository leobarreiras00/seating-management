import { redirect } from "next/navigation";

export default function Home() {
  // Redireciona logo para o login quando alguém acede à raiz
  redirect("/login");
}