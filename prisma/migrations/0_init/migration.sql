-- CreateTable
CREATE TABLE `plant` (
    `PLANT_ID` VARCHAR(255) NOT NULL,
    `NAME` VARCHAR(255) NULL,
    `FAMILY` VARCHAR(255) NULL,
    `CONSERVATION_STATUS` VARCHAR(255) NULL,
    `NATIVE_STATUS` VARCHAR(255) NULL,
    `NAME_NOTE` TEXT NULL,
    `CONSERVATION_STATUS_NOTE` TEXT NULL,
    `NATIVE_STATUS_NOTE` TEXT NULL,
    `SHAPEFILE_PATH` TEXT NULL,
    `INAT_TAXA_ID` VARCHAR(255) NULL,
    `PHOTOS_FLAT` TEXT NULL,
    `PHOTOS_ATTRIBUTION_FLAT` TEXT NULL,
    `PLANT_FORM_GROWTH_HABIT` TEXT NULL,
    `FLOWER_TYPE` TEXT NULL,
    `PEST_AND_DISEASE_INFORMATION` TEXT NULL,
    `NATURAL_RANGE` TEXT NULL,
    `NATURAL_ZONES_ELEVATION_IN_FEET_RAINFALL_IN_INCHES` TEXT NULL,
    `HABITAT` TEXT NULL,
    `ADDITIONAL_HABITAT_INFORMATION` TEXT NULL,
    `EARLY_HAWAIIAN_USE` TEXT NULL,
    `MODERN_USE` TEXT NULL,
    `GENERAL_INFORMATION` TEXT NULL,
    `COMMON_NAME` VARCHAR(255) NULL,

    PRIMARY KEY (`PLANT_ID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plant_list` (
    `plant_list_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,

    UNIQUE INDEX `user_id`(`user_id`),
    PRIMARY KEY (`plant_list_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plant_list_item` (
    `plant_list_item_id` INTEGER NOT NULL AUTO_INCREMENT,
    `plant_list_id` INTEGER NOT NULL,
    `plant_id` VARCHAR(255) NOT NULL,
    `seen_at` DATETIME(0) NULL DEFAULT (now()),

    INDEX `plant_id`(`plant_id`),
    INDEX `plant_list_id`(`plant_list_id`),
    PRIMARY KEY (`plant_list_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(0) NULL DEFAULT (now()),

    UNIQUE INDEX `username`(`username`),
    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `plant_list` ADD CONSTRAINT `plant_list_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `plant_list_item` ADD CONSTRAINT `plant_list_item_ibfk_1` FOREIGN KEY (`plant_list_id`) REFERENCES `plant_list`(`plant_list_id`) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `plant_list_item` ADD CONSTRAINT `plant_list_item_ibfk_2` FOREIGN KEY (`plant_id`) REFERENCES `plant`(`PLANT_ID`) ON DELETE NO ACTION ON UPDATE NO ACTION;

