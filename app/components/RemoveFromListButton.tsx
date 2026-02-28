"use client";

import { useState } from "react";
import { Fab } from "@mui/material";
import { Remove } from "@mui/icons-material";
import Slide, { SlideProps } from "@mui/material/Slide";
import { TransitionProps } from "@mui/material/transitions";
import Snackbar from "@mui/material/Snackbar";

type RemoveFromListButtonProps = {
  id: string;
  onRemoved?: () => void; // <-- added callback prop
};

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

export default function RemoveFromListButton({ id, onRemoved }: RemoveFromListButtonProps) {
  const [state, setState] = useState<{
    open: boolean;
    Transition: React.ComponentType<
      TransitionProps & {
        children: React.ReactElement<any, any>;
      }
    >;
  }>({
    open: false,
    Transition: Slide
  });

  const handleClick =
    (
      Transition: React.ComponentType<
        TransitionProps & {
          children: React.ReactElement<any, any>;
        }
      >
    ) =>
    async () => {
      try {
        const response = await fetch(`/api/plantList?plantId=${id}`, {
          method: "DELETE"
        });

        if (!response.ok) {
          throw new Error("Failed to remove plant from list");
        }

        // Show Snackbar on success
        setState({
          open: true,
          Transition
        });

        // Call the parent's onRemoved callback to refresh the list
        if (onRemoved) onRemoved();
      } catch (error) {
        console.error(error);
        alert("There was an error removing this plant.");
      }
    };

  const handleClose = () => {
    setState({
      ...state,
      open: false
    });
  };

  return (
    <>
      <Fab
        onClick={handleClick(SlideTransition)}
        size="small"
        color="secondary"
        aria-label="remove"
        sx={{
          backgroundColor: "#ef4444",
          "&:hover": {
            backgroundColor: "#b91c1c"
          }
        }}
      >
        <Remove />
      </Fab>

      <Snackbar
        open={state.open}
        onClose={handleClose}
        slots={{ transition: state.Transition }}
        message="Removed from Plant List!"
        key={state.Transition.name}
        autoHideDuration={1400}
      />
    </>
  );
}