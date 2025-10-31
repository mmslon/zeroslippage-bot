"use client";

import { useRouter } from "next/navigation";
import type { FC } from "react";
import React from "react";
import clsx from "clsx";
import Button from "@mui/joy/Button";
import { tClient } from "src/lib/trpc/client";
import type { TBot } from "src/types/trpc";
import { useConfirmationDialog } from "src/ui/confirmation-dialog";
import { useSnackbar } from "src/ui/snackbar";
import { toPage } from "src/utils/next/toPage";

const componentName = "DeleteBotButton";
const classes = {
  root: `${componentName}-root`,
};

type DeleteBotButtonProps = {
  className?: string;
  bot: TBot;
};

export const DeleteBotButton: FC<DeleteBotButtonProps> = ({
  className,
  bot,
}) => {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const { showConfirmDialog } = useConfirmationDialog();
  const tUtils = tClient.useUtils();

  const invalidateState = () => {
    void tUtils.bot.list.invalidate();
    void tUtils.gridBot.list.invalidate();
  };

  const deleteBot = tClient.bot.delete.useMutation({
    onSuccess() {
      invalidateState();

      showSnackbar("Bot has been deleted");

      setTimeout(() => {
        router.push(toPage("grid-bot"));
      }, 1500);
    },
  });

  if (deleteBot.isLoading) {
    return (
      <Button
        className={clsx(classes.root, className)}
        color="danger"
        loading
        loadingPosition="start"
        size="lg"
        variant="soft"
      >
        Deleting...
      </Button>
    );
  }

  return (
    <Button
      className={clsx(classes.root, className)}
      color="danger"
      loading={deleteBot.isLoading}
      loadingPosition="start"
      onClick={() => {
        showConfirmDialog(
          "Are you sure you want to delete the bot? All orders and profit history will be deleted as well.",
          () => {
            void deleteBot.mutate({
              botId: bot.id,
            });
          },
          {
            confirmText: "Delete",
            confirmButtonColor: "danger",
            confirmButtonVariant: "outlined",
          },
        );
      }}
      size="lg"
      variant="soft"
    >
      Delete bot
    </Button>
  );
};
