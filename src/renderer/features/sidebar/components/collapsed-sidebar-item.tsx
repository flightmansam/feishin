import { createPolymorphicComponent, Flex } from '@mantine/core';
import { motion } from 'framer-motion';
import { forwardRef } from 'react';
import styled from 'styled-components';
import { Text } from '/@/renderer/components';

const Container = styled(Flex)<{ $active?: boolean; $disabled?: boolean }>`
  position: relative;
  width: 100%;
  padding: 0.9rem 0.3rem;
  border-right: var(--sidebar-border);
  cursor: ${(props) => (props.$disabled ? 'default' : 'pointer')};
  opacity: ${(props) => props.$disabled && 0.6};

  svg {
    fill: ${(props) => (props.$active ? 'var(--primary-color)' : 'var(--sidebar-fg)')};
  }

  &:focus-visible {
    background-color: var(--sidebar-bg-hover);
    outline: none;
  }

  ${(props) =>
    !props.$disabled &&
    `
      &:hover {
          background-color: var(--sidebar-bg-hover);

          div {
            color: var(--main-fg) !important;
          }

          svg {
            fill: var(--primary-color);
          }
        }
    `}
`;

const TextWrapper = styled.div`
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-align: center;
  text-overflow: ellipsis;
`;

const ActiveTabIndicator = styled(motion.div)`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 3px;
  width: 2px;
  height: 80%;
  margin-top: auto;
  margin-bottom: auto;
  background: var(--primary-color);
`;

interface CollapsedSidebarItemProps {
  active?: boolean;
  activeIcon: React.ReactNode;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}

const _CollapsedSidebarItem = forwardRef<HTMLDivElement, CollapsedSidebarItemProps>(
  ({ active, activeIcon, icon, label, disabled, ...props }: CollapsedSidebarItemProps, ref) => {
    return (
      <Container
        ref={ref}
        $active={active}
        $disabled={disabled}
        align="center"
        direction="column"
        {...props}
      >
        {active && <ActiveTabIndicator layoutId="active-tab-indicator" />}
        {active ? activeIcon : icon}
        <TextWrapper>
          <Text
            $secondary={!active}
            fw="600"
            overflow="hidden"
            size="xs"
          >
            {label}
          </Text>
        </TextWrapper>
      </Container>
    );
  },
);

export const CollapsedSidebarItem = createPolymorphicComponent<'button', CollapsedSidebarItemProps>(
  _CollapsedSidebarItem,
);
