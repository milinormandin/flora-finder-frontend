"use client";

import { useState } from "react";
import { Fab } from "@mui/material";
import { Add } from "@mui/icons-material";
import Slide, { SlideProps } from "@mui/material/Slide";
import { TransitionProps } from "@mui/material/transitions";
import Snackbar from "@mui/material/Snackbar";

type AddToListButtonProps = {
  id: string;
};

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

export default function AddToListButton({ id }: AddToListButtonProps) {
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
        // Make POST request to add plant to list
        const response = await fetch("/api/plantList", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ plantId: id })
        });

        if (!response.ok) {
          throw new Error("Failed to add plant to list");
        }

        // Show Snackbar on success
        setState({
          open: true,
          Transition
        });
      } catch (error) {
        console.error(error);
        alert("There was an error adding this plant.");
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
        color="primary"
        aria-label="add"
        sx={{
          backgroundColor: "#22c55e", // Tailwind green-500
          "&:hover": {
            backgroundColor: "#16a34a" // Tailwind green-600
          }
        }}
      >
        <Add />
      </Fab>

      <Snackbar
        open={state.open}
        onClose={handleClose}
        slots={{ transition: state.Transition }}
        message="Added to Plant List!"
        key={state.Transition.name}
        autoHideDuration={1200}
      />
    </>
  );
}