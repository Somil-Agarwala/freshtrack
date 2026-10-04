"use client";

import { useLang } from "@/lib/i18n";
import { AccountCard } from "@/components/account/account-card";
import { LangToggle } from "@/components/layout/lang-toggle";
import { MoreList } from "@/components/layout/more-list";
import { MenuIcon } from "@/components/ft/icons";
import { ListHeader, Screen, ScreenBody } from "@/components/ft/screen";

/** Phone: every other page, one tap from the home screen. */
export default function MorePage() {
  const { t } = useLang();
  return (
    <Screen>
      <ListHeader tone="neutral" icon={<MenuIcon size={26} />} title={t("और सब", "Everything else")} subtitle={t("रिकॉर्ड, मास्टर डेटा, एडमिन", "Records, master data, admin")} />
      <ScreenBody className="pt-0">
        <AccountCard />
        <LangToggle className="self-start" />
        <MoreList />
      </ScreenBody>
    </Screen>
  );
}
