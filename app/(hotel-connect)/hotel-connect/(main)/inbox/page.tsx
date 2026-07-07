import ConnectHeader from "../components/ConnectHeader";
import GroupInbox from "./GroupInbox";
import { getOwnerConversations } from "./inbox-actions";

export default async function GroupInboxPage() {
  const conversations = await getOwnerConversations();

  return (
    <>
      <ConnectHeader title="Group Inbox" />
      <GroupInbox initialConversations={conversations} />
    </>
  );
}
