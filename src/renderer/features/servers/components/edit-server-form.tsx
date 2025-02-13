import { useState } from 'react';
import { Checkbox, Stack, Group } from '@mantine/core';
import { Button, PasswordInput, TextInput, toast, Tooltip } from '/@/renderer/components';
import { useForm } from '@mantine/form';
import { useFocusTrap } from '@mantine/hooks';
import { closeAllModals } from '@mantine/modals';
import { RiInformationLine } from 'react-icons/ri';
import { AuthenticationResponse } from '/@/renderer/api/types';
import { useAuthStoreActions } from '/@/renderer/store';
import { ServerListItem, ServerType } from '/@/renderer/types';
import { api } from '/@/renderer/api';

interface EditServerFormProps {
  isUpdate?: boolean;
  onCancel: () => void;
  server: ServerListItem;
}

const ModifiedFieldIndicator = () => {
  return (
    <Tooltip label="Field has been modified">
      <span>
        <RiInformationLine color="red" />
      </span>
    </Tooltip>
  );
};

export const EditServerForm = ({ isUpdate, server, onCancel }: EditServerFormProps) => {
  const { updateServer } = useAuthStoreActions();
  const focusTrapRef = useFocusTrap();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm({
    initialValues: {
      legacyAuth: false,
      name: server?.name,
      password: '',
      type: server?.type,
      url: server?.url,
      username: server?.username,
    },
  });

  const isSubsonic = form.values.type === ServerType.SUBSONIC;

  const handleSubmit = form.onSubmit(async (values) => {
    const authFunction = api.controller.authenticate;

    if (!authFunction) {
      return toast.error({ message: 'Selected server type is invalid' });
    }

    try {
      setIsLoading(true);
      const data: AuthenticationResponse | undefined = await authFunction(
        values.url,
        {
          legacy: values.legacyAuth,
          password: values.password,
          username: values.username,
        },
        values.type,
      );

      if (!data) {
        return toast.error({ message: 'Authentication failed' });
      }

      const serverItem = {
        credential: data.credential,
        name: values.name,
        ndCredential: data.ndCredential,
        type: values.type,
        url: values.url,
        userId: data.userId,
        username: data.username,
      };

      updateServer(server.id, serverItem);
      toast.success({ message: 'Server has been updated' });
    } catch (err: any) {
      setIsLoading(false);
      return toast.error({ message: err?.message });
    }

    if (isUpdate) closeAllModals();
    return setIsLoading(false);
  });

  return (
    <form onSubmit={handleSubmit}>
      <Stack ref={focusTrapRef}>
        <TextInput
          required
          label="Name"
          rightSection={form.isDirty('name') && <ModifiedFieldIndicator />}
          {...form.getInputProps('name')}
        />
        <TextInput
          required
          label="Url"
          rightSection={form.isDirty('url') && <ModifiedFieldIndicator />}
          {...form.getInputProps('url')}
        />
        <TextInput
          required
          label="Username"
          rightSection={form.isDirty('username') && <ModifiedFieldIndicator />}
          {...form.getInputProps('username')}
        />
        <PasswordInput
          data-autofocus
          required
          label="Password"
          {...form.getInputProps('password')}
        />
        {isSubsonic && (
          <Checkbox
            label="Enable legacy authentication"
            {...form.getInputProps('legacyAuth', {
              type: 'checkbox',
            })}
          />
        )}
        <Group position="right">
          <Button
            variant="subtle"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            loading={isLoading}
            type="submit"
            variant="filled"
          >
            Save
          </Button>
        </Group>
      </Stack>
    </form>
  );
};
