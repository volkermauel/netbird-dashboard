import { notify } from "@components/Notification";
import SkeletonPeerDetail from "@components/skeletons/SkeletonPeerDetail";
import { useApiCall } from "@utils/api";
import React, { useMemo } from "react";
import { useSWRConfig } from "swr";
import { useDialog } from "@/contexts/DialogProvider";
import { useGroups } from "@/contexts/GroupsProvider";
import { useUsers } from "@/contexts/UsersProvider";
import { Group, GroupPeer } from "@/interfaces/Group";
import { Peer } from "@/interfaces/Peer";
import { User } from "@/interfaces/User";

type Props = {
  children: React.ReactNode;
  peer: Peer;
};

const PeerContext = React.createContext(
  {} as {
    peer: Peer;
    user?: User;
    peerGroups: Group[];
    update: (props: {
      name?: string;
      ssh?: boolean;
      loginExpiration?: boolean;
      inactivityExpiration?: boolean;
      approval_required?: boolean;
    }) => Promise<Peer>;
    openSSHDialog: () => Promise<boolean>;
    deletePeer: () => void;
    isLoading: boolean;
  },
);

export default function PeerProvider({ children, peer }: Props) {
  const user = usePeerUser(peer);
  const { peerGroups, isLoading } = usePeerGroups(peer);
  const peerRequest = useApiCall<Peer>("/peers");
  const { confirm } = useDialog();
  const { mutate } = useSWRConfig();

  const deletePeer = async () => {
    const choice = await confirm({
      title: `Delete '${peer.name}'?`,
      description:
        "Are you sure you want to delete this peer? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
    });
    if (choice) {
      notify({
        title: peer.name,
        description: "Peer was successfully deleted",
        promise: peerRequest.del({}, `/${peer.id}`).then(() => {
          mutate("/peers");
          mutate("/groups");
        }),
        loadingMessage: "Deleting peer...",
      });
    }
  };

  const update = async (props: {
    name?: string;
    ssh?: boolean;
    loginExpiration?: boolean;
    inactivityExpiration?: boolean;
    approval_required?: boolean;
  }) => {
    return peerRequest.put(
      {
        name: props.name !== undefined ? props.name : peer.name,
        ssh_enabled: props.ssh !== undefined ? props.ssh : peer.ssh_enabled,
        login_expiration_enabled:
          props.loginExpiration !== undefined
            ? props.loginExpiration
            : peer.login_expiration_enabled,
        inactivity_expiration_enabled:
          props.inactivityExpiration !== undefined
            ? props.inactivityExpiration
            : peer.inactivity_expiration_enabled,
        approval_required:
          props.approval_required !== undefined
            ? props.approval_required
            : peer.approval_required,
      },
      `/${peer.id}`,
    );
  };

  const openSSHDialog = async (): Promise<boolean> => {
    return await confirm({
      title: `Enable SSH Server for ${peer.name}?`,
      description:
        "Experimental feature. Enabling this option allows remote SSH access to this machine from other connected network participants.",
      confirmText: "Enable",
      cancelText: "Cancel",
      type: "warning",
    });
  };

  return !isLoading ? (
    <PeerContext.Provider
      value={{
        peer,
        peerGroups,
        user,
        update,
        openSSHDialog,
        deletePeer,
        isLoading,
      }}
    >
      {children}
    </PeerContext.Provider>
  ) : (
    <SkeletonPeerDetail />
  );
}

/**
 * Get the groups of a peer
 * @param peer
 */
export const usePeerGroups = (peer?: Peer) => {
  const { groups, isLoading } = useGroups();

  const peerGroups = useMemo(() => {
    if (!peer) return [];
    const peerGroups = groups?.filter((group) => {
      const foundGroup = group.peers?.find((p) => {
        const peerGroup = p as GroupPeer;
        return peerGroup.id === peer.id;
      });
      return foundGroup !== undefined;
    });
    return peerGroups || [];
  }, [groups, peer]);

  return { peerGroups, isLoading };
};

/**
 * Get the user of a peer
 * @param peer
 */
export const usePeerUser = (peer: Peer) => {
  const { users } = useUsers();

  return useMemo(() => {
    return users?.find((user) => user.id === peer.user_id);
  }, [users, peer]);
};

/**
 * Access the peer context
 */
export const usePeer = () => React.useContext(PeerContext);
