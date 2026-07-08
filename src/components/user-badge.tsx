import { useCurrentUser, setCurrentUser } from "@/lib/current-user";
import { Input } from "@/components/ui/input";
import { UserCircle2 } from "lucide-react";

export function UserBadge() {
  const user = useCurrentUser();
  return (
    <div className="flex items-center gap-2">
      <UserCircle2 className="h-4 w-4 text-muted-foreground" />
      <Input
        value={user}
        onChange={(e) => setCurrentUser(e.target.value)}
        placeholder="Initiales"
        className="h-8 w-24 uppercase font-mono"
        maxLength={4}
      />
    </div>
  );
}
