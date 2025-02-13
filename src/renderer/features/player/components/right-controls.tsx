import { MouseEvent } from 'react';
import { Flex, Group } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { HiOutlineQueueList } from 'react-icons/hi2';
import {
  RiVolumeUpFill,
  RiVolumeDownFill,
  RiVolumeMuteFill,
  RiHeartLine,
  RiHeartFill,
} from 'react-icons/ri';
import {
  useAppStoreActions,
  useCurrentServer,
  useCurrentSong,
  useHotkeySettings,
  useMuted,
  useSidebarStore,
  useVolume,
} from '/@/renderer/store';
import { useRightControls } from '../hooks/use-right-controls';
import { PlayerButton } from './player-button';
import { LibraryItem, ServerType } from '/@/renderer/api/types';
import { useCreateFavorite, useDeleteFavorite, useSetRating } from '/@/renderer/features/shared';
import { Rating } from '/@/renderer/components';
import { PlayerbarSlider } from '/@/renderer/features/player/components/playerbar-slider';

export const RightControls = () => {
  const volume = useVolume();
  const muted = useMuted();
  const server = useCurrentServer();
  const currentSong = useCurrentSong();
  const { setSideBar } = useAppStoreActions();
  const { rightExpanded: isQueueExpanded } = useSidebarStore();
  const { bindings } = useHotkeySettings();
  const { handleVolumeSlider, handleVolumeWheel, handleMute, handleVolumeDown, handleVolumeUp } =
    useRightControls();

  const updateRatingMutation = useSetRating({});
  const addToFavoritesMutation = useCreateFavorite({});
  const removeFromFavoritesMutation = useDeleteFavorite({});

  const handleAddToFavorites = () => {
    if (!currentSong) return;

    addToFavoritesMutation.mutate({
      query: {
        id: [currentSong.id],
        type: LibraryItem.SONG,
      },
      serverId: currentSong?.serverId,
    });
  };

  const handleUpdateRating = (rating: number) => {
    if (!currentSong) return;

    updateRatingMutation.mutate({
      query: {
        item: [currentSong],
        rating,
      },
      serverId: currentSong?.serverId,
    });
  };

  const handleClearRating = (_e: MouseEvent<HTMLDivElement>, rating?: number) => {
    if (!currentSong || !rating) return;

    updateRatingMutation.mutate({
      query: {
        item: [currentSong],
        rating: 0,
      },
      serverId: currentSong?.serverId,
    });
  };

  const handleRemoveFromFavorites = () => {
    if (!currentSong) return;

    removeFromFavoritesMutation.mutate({
      query: {
        id: [currentSong.id],
        type: LibraryItem.SONG,
      },
      serverId: currentSong?.serverId,
    });
  };

  const handleToggleFavorite = () => {
    if (!currentSong) return;

    if (currentSong.userFavorite) {
      handleRemoveFromFavorites();
    } else {
      handleAddToFavorites();
    }
  };

  const handleToggleQueue = () => {
    setSideBar({ rightExpanded: !isQueueExpanded });
  };

  const isSongDefined = Boolean(currentSong?.id);
  const showRating = isSongDefined && server?.type === ServerType.NAVIDROME;

  useHotkeys([
    [bindings.volumeDown.isGlobal ? '' : bindings.volumeDown.hotkey, handleVolumeDown],
    [bindings.volumeUp.isGlobal ? '' : bindings.volumeUp.hotkey, handleVolumeUp],
    [bindings.volumeMute.isGlobal ? '' : bindings.volumeMute.hotkey, handleMute],
    [bindings.toggleQueue.isGlobal ? '' : bindings.toggleQueue.hotkey, handleToggleQueue],
  ]);

  return (
    <Flex
      align="flex-end"
      direction="column"
      h="100%"
      px="1rem"
      py="0.5rem"
    >
      <Group h="calc(100% / 3)">
        {showRating && (
          <Rating
            size="sm"
            value={currentSong?.userRating || 0}
            onChange={handleUpdateRating}
            onClick={handleClearRating}
          />
        )}
      </Group>
      <Group
        noWrap
        align="center"
        spacing="xs"
      >
        <PlayerButton
          icon={
            currentSong?.userFavorite ? (
              <RiHeartFill
                color="var(--primary-color)"
                size="1.1rem"
              />
            ) : (
              <RiHeartLine size="1.1rem" />
            )
          }
          sx={{
            svg: {
              fill: !currentSong?.userFavorite ? undefined : 'var(--primary-color) !important',
            },
          }}
          tooltip={{
            label: currentSong?.userFavorite ? 'Unfavorite' : 'Favorite',
            openDelay: 500,
          }}
          variant="secondary"
          onClick={handleToggleFavorite}
        />
        <PlayerButton
          icon={<HiOutlineQueueList size="1.1rem" />}
          tooltip={{ label: 'View queue', openDelay: 500 }}
          variant="secondary"
          onClick={handleToggleQueue}
        />
        <Group
          noWrap
          spacing="xs"
        >
          <PlayerButton
            icon={
              muted ? (
                <RiVolumeMuteFill size="1.2rem" />
              ) : volume > 50 ? (
                <RiVolumeUpFill size="1.2rem" />
              ) : (
                <RiVolumeDownFill size="1.2rem" />
              )
            }
            tooltip={{ label: muted ? 'Muted' : volume, openDelay: 500 }}
            variant="secondary"
            onClick={handleMute}
          />
          <PlayerbarSlider
            max={100}
            min={0}
            size={6}
            value={volume}
            w="60px"
            onChange={handleVolumeSlider}
            onWheel={handleVolumeWheel}
          />
        </Group>
      </Group>
      <Group h="calc(100% / 3)" />
    </Flex>
  );
};
