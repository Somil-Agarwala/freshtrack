"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { BAG_CAPACITY } from "@/lib/bag-packing";

export function SettingsForm() {
  const [uncountedReminders, setUncountedReminders] = useState(true);
  const [settlementAlerts, setSettlementAlerts] = useState(true);

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar name="Somil" className="h-14 w-14 text-lg" />
          <div className="flex-1 space-y-3">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" defaultValue="Somil" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="somil@freshtrack.app" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button size="sm">Save changes</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Packing</CardTitle>
            <CardDescription>How sorted bags are built</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="capacity">Pieces per bag</Label>
            <Input id="capacity" type="number" defaultValue={BAG_CAPACITY} disabled />
            <p className="mt-1.5 text-xs text-ink-faint">
              Currently fixed in code at {BAG_CAPACITY}. This becomes editable once settings are stored in Supabase.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Reminders</CardTitle>
            <CardDescription>What you want to be told about</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">Uncounted collections</p>
              <p className="text-xs text-ink-dim">Remind me about bags sitting uncounted for too long</p>
            </div>
            <Switch checked={uncountedReminders} onCheckedChange={setUncountedReminders} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink">Settlement shortfalls</p>
              <p className="text-xs text-ink-dim">Tell me when a dispatch is settled below the claimed value</p>
            </div>
            <Switch checked={settlementAlerts} onCheckedChange={setSettlementAlerts} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
