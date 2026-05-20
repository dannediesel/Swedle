import { FriendshipStatus, GameMode, SessionStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { getAllPlayers } from "./playerService";

type UserSummary = {
  id: string;
  username: string;
};

type ChallengeAttemptWithUser = {
  userId: string;
  gameSessionId: string;
  user: UserSummary;
  gameSession: {
    status: SessionStatus;
    attempts: number;
  };
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

function formatChallengeForUser(
  currentUserId: string,
  challenge: {
    id: string;
    creatorId: string;
    createdAt: Date;
    creator: UserSummary;
    attempts: ChallengeAttemptWithUser[];
  }
) {
  const myAttempt = challenge.attempts.find(
    (attempt) => attempt.userId === currentUserId
  );
  const opponentAttempt = challenge.attempts.find(
    (attempt) => attempt.userId !== currentUserId
  );
  const opponent =
    opponentAttempt?.user ??
    (challenge.creatorId === currentUserId ? null : challenge.creator);

  if (!myAttempt || !opponent) {
    return null;
  }

  return {
    id: challenge.id,
    sessionId: myAttempt.gameSessionId,
    opponent: toUserSummary(opponent),
    createdByCurrentUser: challenge.creatorId === currentUserId,
    myStatus: myAttempt.gameSession.status,
    myAttempts: myAttempt.gameSession.attempts,
    opponentStatus: opponentAttempt?.gameSession.status ?? "IN_PROGRESS",
    opponentAttempts: opponentAttempt?.gameSession.attempts ?? 0,
    createdAt: challenge.createdAt,
  };
}

async function ensureCreatorAttemptsForExistingChallenges(currentUserId: string) {
  const challenges = await prisma.friendChallenge.findMany({
    where: {
      creatorId: currentUserId,
      attempts: {
        none: {
          userId: currentUserId,
        },
      },
    },
  });

  for (const challenge of challenges) {
    await prisma.$transaction(async (tx) => {
      const existingAttempt = await tx.friendChallengeAttempt.findUnique({
        where: {
          friendChallengeId_userId: {
            friendChallengeId: challenge.id,
            userId: currentUserId,
          },
        },
      });

      if (existingAttempt) {
        return;
      }

      const session = await tx.gameSession.create({
        data: {
          userId: currentUserId,
          mode: GameMode.FRIEND_CHALLENGE,
          status: SessionStatus.IN_PROGRESS,
          targetPlayerName: challenge.targetPlayerName,
        },
      });

      await tx.friendChallengeAttempt.create({
        data: {
          friendChallengeId: challenge.id,
          userId: currentUserId,
          gameSessionId: session.id,
        },
      });
    });
  }
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
  await ensureCreatorAttemptsForExistingChallenges(currentUserId);

  const [friendships, friendChallenges] = await Promise.all([
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
    prisma.friendChallenge.findMany({
      where: {
        attempts: {
          some: {
            userId: currentUserId,
          },
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
          },
        },
        attempts: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
            gameSession: {
              select: {
                status: true,
                attempts: true,
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
    friendChallenges: friendChallenges
      .map((challenge) => formatChallengeForUser(currentUserId, challenge))
      .filter((challenge) => challenge !== null),
  };
}

export async function createChallengeForFriend(
  currentUserId: string,
  friendId: string
) {
  const [friendship, friend] = await Promise.all([
    findFriendshipBetween(currentUserId, friendId),
    prisma.user.findUnique({
      where: { id: friendId },
      select: {
        id: true,
        username: true,
      },
    }),
  ]);

  if (!friend || !friendship || friendship.status !== FriendshipStatus.ACCEPTED) {
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

    const creatorSession = await tx.gameSession.create({
      data: {
        userId: currentUserId,
        mode: GameMode.FRIEND_CHALLENGE,
        status: SessionStatus.IN_PROGRESS,
        targetPlayerName,
      },
    });

    const friendSession = await tx.gameSession.create({
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
        userId: currentUserId,
        gameSessionId: creatorSession.id,
      },
    });

    await tx.friendChallengeAttempt.create({
      data: {
        friendChallengeId: challenge.id,
        userId: friendId,
        gameSessionId: friendSession.id,
      },
    });

    return {
      id: challenge.id,
      sessionId: creatorSession.id,
      opponent: toUserSummary(friend),
      createdByCurrentUser: true,
      myStatus: creatorSession.status,
      myAttempts: creatorSession.attempts,
      opponentStatus: friendSession.status,
      opponentAttempts: friendSession.attempts,
      createdAt: challenge.createdAt,
    };
  });
}
