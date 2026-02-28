import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Image from "next/image";
import Link from "next/link";

type MediaCardProps = {
  name: string;
  commonName?: string; // optional
  photo: string; // optional
  conservationStatus?: string;
  id?: string;
};

export default function MediaCard({
  name,
  commonName,
  photo,
  conservationStatus,
  id,
}: MediaCardProps) {
  return (
    <Card sx={{ maxWidth: 345, display: "flex", flexDirection: "column" }}>
      {/* Image */}
      <div style={{ position: "relative", width: "100%", height: 200 }}>
        <Image
          src={photo || "/placeholder-plant.jpg"}
          alt={name}
          fill
          style={{ objectFit: "cover" }}
        />
      </div>

      {/* Text Content */}
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography gutterBottom variant="h6" noWrap>
          <Link href={`/plant/${id}`}>{name}</Link>
        </Typography>

        <Typography variant="body2" color="text.secondary" noWrap>
          {commonName}
        </Typography>

        {/* Conservation Status Chip */}
        <Chip
          label={conservationStatus || "Unknown"}
          color={
            conservationStatus === "Endangered"
              ? "error"
              : conservationStatus === "Vulnerable"
              ? "warning"
              : "success"
          }
          size="small"
          sx={{ mt: 1 }}
        />
      </CardContent>
    </Card>
  );
}