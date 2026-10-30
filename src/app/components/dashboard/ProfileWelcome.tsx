"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type StoredUser = {
  fullName?: string;
  name?: string;
  firstName?: string;
  email?: string;
  user?: StoredUser;
  data?: {
    user?: StoredUser;
  };
};

const ProfileWelcome = () => {
  const [userName, setUserName] = useState("there");

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");

      if (!storedUser) {
        return;
      }

      const parsedUser: StoredUser = JSON.parse(storedUser);
      const user = parsedUser.data?.user ?? parsedUser.user ?? parsedUser;

      const name =
        user.fullName?.trim() ||
        user.name?.trim() ||
        user.firstName?.trim() ||
        user.email?.split("@")[0] ||
        "there";

      setUserName(name);
    } catch (error) {
      console.error("Unable to read the logged-in user's details:", error);
    }
  }, []);

  return (
    <div className="relative flex items-center justify-between rounded-lg bg-lightsecondary p-6">
      <div className="flex items-center gap-3">
        <div>
          <Image
            src="/images/profile/user-1.jpg"
            alt="User profile"
            width={50}
            height={50}
            className="rounded-full"
          />
        </div>

        <div className="flex flex-col gap-0.5">
          <h5 className="card-title">
            Welcome back, {userName}! 👋
          </h5>

          <p className="text-muted-foreground">
            Here&apos;s your lead management dashboard.
          </p>
        </div>
      </div>

      <div className="absolute bottom-0 right-8 hidden sm:block">
        <Image
          src="/images/dashboard/customer-support-img.png"
          alt="Dashboard illustration"
          width={145}
          height={95}
        />
      </div>
    </div>
  );
};

export default ProfileWelcome;