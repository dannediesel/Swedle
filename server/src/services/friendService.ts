import { FriendshipStatus, GameMode, SessionStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { getAllPlayers } from "./playerService";

type UserSummary = {
  id: string;
  username: string;
};

function toUserSummary(user: UserSummary): UserSummary {
  return {
    id: user.id,
    username: user.username,
  };
}

async function findFriendshipBetween(userId: string, otherUserId: string) {
  return prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, receiverId: otherUserId },
        { requesterId: otherUserId, receiverId: userId },
      ],
    },
  });
}

function getFriendshipLabel(
  friendship: Awaited<ReturnType<typeof findFriendshipBetween>>,
  currentUserId: string
) {
  if (!friendship) {
    return "NONE";
  }

  if (friendship.status === FriendshipStatus.ACCEPTED) {
    return "FRIENDS";
  }

  if (friendship.status === FriendshipStatus.REJECTED) {
    return "REJECTED";
  }

  return friendship.requesterId === currentUserId ? "REQUEST_SENT" : "REQUEST_RECEIVED";
}

async function getRandomTargetPlayerName() {
  const players = await getAllPlayers();

  if (players.length === 0) {
    throw new Error("No players available");
  }

  const randomIndex = Math.floor(Math.random() * players.length);
  return players[randomIndex].fullName;
}

function createChallengeCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function searchUsersForFriends(currentUserId: string, query: string) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        not: currentUserId,
      },
      username: {
        contains: trimmedQuery,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      username: true,
    },
    orderBy: {
      username: "asc",
    },
    take: 8,
  });

  return Promise.all(
    users.map(async (user) => {
      const friendship = await findFriendshipBetween(currentUserId, user.id);

      return {
        ...toUserSummary(user),
        friendshipStatus: getFriendshipLabel(friendship, currentUserId),
      };
    })
  );
}

export async function sendFriendRequest(currentUserId: string, username: string) {
  const receiver = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
    },
  });

  if (!receiver) {
    throw new Error("User not found");
  }

  if (receiver.id === currentUserId) {
    throw new Error("You cannot add yourself as a friend");
  }

  const existingFriendship = await findFriendshipBetween(currentUserId, receiver.id);

  if (existingFriendship) {
    if (existingFriendship.status === FriendshipStatus.REJECTED) {
      return prisma.friendship.update({
        where: { id: existingFriendship.id },
        data: {
          requesterId: currentUserId,
          receiverId: receiver.id,
          status: FriendshipStatus.PENDING,
        },
      });
    }

    throw new Error("Friendship already exists");
  }

  return prisma.friendship.create({
    data: {
      requesterId: currentUserId,
      receiverId: receiver.id,
    },
  });
}

export async function respondToFriendRequest(
  currentUserId: string,
  friendshipId: string,
  action: "accept" | "reject"
) {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.receiverId !== currentUserId) {
    throw new Error("Friend request not found");
  }

  if (friendship.status !== FriendshipStatus.PENDING) {
    throw new Error("Friend request is no longer pending");
  }

  return prisma.friendship.update({
    where: { id: friendship.id },
    data: {
      status:
        action === "accept"
          ? FriendshipStatus.ACCEPTED
          : FriendshipStatus.REJECTED,
    },
  });
}

export async function getFriendsDashboard(currentUserId: string) {
  const [friendships, incomingChallenges] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        OR: [{ requesterId: currentUserId }, { receiverId: currentUserId }],
        status: {
          in: [FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED],
        },
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.friendChallengeAttempt.findMany({
      where: {
        userId: currentUserId,
      },
      include: {
        gameSession: true,
        friendChallenge: {
          include: {
            creator: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    }),
  ]);

  const friends = friendships
    .filter((friendship) => friendship.status === FriendshipStatus.ACCEPTED)
    .map((friendship) => {
      const friend =
        friendship.requesterId === currentUserId
          ? friendship.receiver
          : friendship.requester;

      return {
        friendshipId: friendship.id,
        ...toUserSummary(friend),
      };
    });

  const incomingRequests = friendships
    .filter(
      (friendship) =>
        friendship.status === FriendshipStatus.PENDING &&
        friendship.receiverId === currentUserId
    )
    .map((friendship) => ({
      id: friendship.id,
      requester: toUserSummary(friendship.requester),
      createdAt: friendship.createdAt,
    }));

  const outgoingRequests = friendships
    .filter(
      (friendship) =>
        friendship.status === FriendshipStatus.PENDING &&
        friendship.requesterId === currentUserId
    )
    .map((friendship) => ({
      id: friendship.id,
      receiver: toUserSummary(friendship.receiver),
      createdAt: friendship.createdAt,
    }));

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    incomingChallenges: incomingChallenges.map((attempt) => ({
      id: attempt.friendChallenge.id,
      sessionId: attempt.gameSessionId,
      creator: toUserSummary(attempt.friendChallenge.creator),
      status: attempt.gameSession.status,
      attempts: attempt.gameSession.attempts,
      createdAt: attempt.friendChallenge.createdAt,
    })),
  };
}

export async function createChallengeForFriend(
  currentUserId: string,
  friendId: string
) {
  const friendship = await findFriendshipBetween(currentUserId, friendId);

  if (!friendship || friendship.status !== FriendshipStatus.ACCEPTED) {
    throw new Error("You can only challenge accepted friends");
  }

  const targetPlayerName = await getRandomTargetPlayerName();

  return prisma.$transaction(async (tx) => {
    const challenge = await tx.friendChallenge.create({
      data: {
        creatorId: currentUserId,
        challengeCode: createChallengeCode(),
        targetPlayerName,
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    const session = await tx.gameSession.create({
      data: {
        userId: friendId,
        mode: GameMode.FRIEND_CHALLENGE,
        status: SessionStatus.IN_PROGRESS,
        targetPlayerName,
      },
    });

    await tx.friendChallengeAttempt.create({
      data: {
        friendChallengeId: challenge.id,
        userId: friendId,
        gameSessionId: session.id,
      },
    });

    return {
      id: challenge.id,
      sessionId: session.id,
      creator: toUserSummary(challenge.creator),
      status: session.status,
      attempts: session.attempts,
      createdAt: challenge.createdAt,
    };
  });
}
