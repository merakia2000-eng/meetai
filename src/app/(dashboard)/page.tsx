import { auth } from "@/lib/auth";
import { headers } from "next/headers"; // 确保引入了 headers
import { redirect } from "next/navigation";
import { HomeView } from "@/modules/home/ui/views/home-view";

import { caller } from "@/trpc/server";

const Page = async () => {
  // 2. 这里也要改写成 trpc.xxx.query()
  // 注意：最新的 tRPC Server Proxy 语法通常是这样的
  const data = await caller.hello({ text: "Merakia Hello" });

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div>
      <p>{data?.greeting}</p>
      {/* <HomeView /> */}
    </div>
  );
};

export default Page;