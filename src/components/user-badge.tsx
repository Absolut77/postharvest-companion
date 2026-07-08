import { useStore, actions } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { UserCircle2 } from "lucide-react";

export function UserBadge() {
  const { currentUser } = useStore();
  return (
    <div className="flex items-center gap-2">
      <UserCircle2 className="h-4 w-4 text-muted-foreground" />
      <Input
        value={currentUser}
        onChange={(e) => actions.setUser(e.target.value.toUpperCase().slice(0, 4))}
        placeholder="Initiales"
        className="h-8 w-24 uppercase"
      />
    </div>
  );
}
