import type { ContentMessage } from "@/lib/content-messages/types";

export type ContentMessageThreadViewer = "staff" | "owner";

export type ContentMessageChatItem = {
  id: string;
  body: string;
  senderName: string | null;
  createdAt: string;
  isMine: boolean;
  isReply: boolean;
};

type ThreadSource = Pick<
  ContentMessage,
  "id" | "body" | "senderName" | "createdAt" | "parentMessageId" | "senderRole"
> & {
  replies?: ThreadSource[];
};

export function isStaffContentMessage(message: {
  senderRole?: string | null;
  parentMessageId?: string | null;
}): boolean {
  if (message.senderRole === "admin" || message.senderRole === "client") return true;
  return !message.parentMessageId;
}

function toChatItem(message: ThreadSource, viewer: ContentMessageThreadViewer): ContentMessageChatItem {
  const isStaff = isStaffContentMessage(message);
  return {
    id: message.id,
    body: message.body,
    senderName: message.senderName,
    createdAt: message.createdAt,
    isMine: viewer === "staff" ? isStaff : !isStaff,
    isReply: Boolean(message.parentMessageId),
  };
}

export function threadFromRoot(
  root: ThreadSource,
  viewer: ContentMessageThreadViewer
): ContentMessageChatItem[] {
  return [root, ...(root.replies ?? [])].map((message) => toChatItem(message, viewer));
}

export function threadFromRoots(
  roots: ThreadSource[],
  viewer: ContentMessageThreadViewer
): ContentMessageChatItem[] {
  return [...roots]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .flatMap((root) => threadFromRoot(root, viewer));
}
