import type { FC } from "react";
import React from "react";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import DialogTitle from "@mui/joy/DialogTitle";
import { useSnackbar } from "src/ui/snackbar";
import { CreateAccountForm } from "../CreateAccountForm/CreateAccountForm";

type NewAccountDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export const CreateAccountDialog: FC<NewAccountDialogProps> = (props) => {
  const { open, onClose, onCreated } = props;
  const { showSnackbar } = useSnackbar();

  return (
    <Modal onClose={onClose} open={open}>
      <ModalDialog maxWidth={500}>
        <DialogTitle>New exchange account</DialogTitle>

        <CreateAccountForm
          onCreated={() => {
            onCreated();
            onClose();

            showSnackbar("Account created");
          }}
          onError={(error) => {
            showSnackbar(JSON.stringify(error), {
              color: "danger",
              autoHideDuration: 5000,
            });
            console.log(error);
          }}
        />
      </ModalDialog>
    </Modal>
  );
};
