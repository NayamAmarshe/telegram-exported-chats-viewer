import {
  findFileInFolder,
  getRelativePath,
  type ParsedMessage,
  type MediaItem,
  type ReplyTo,
} from "./file-handler";

export const parseMessage = async (
  messageDiv: Element,
  allFiles: File[],
  basePath: string
): Promise<ParsedMessage> => {
  const id = messageDiv.id;
  const isService = messageDiv.classList.contains("service");

  if (isService) {
    const body = messageDiv.querySelector(".body");
    return {
      id,
      type: "service",
      text: body?.textContent?.trim() || "",
    };
  }

  // Check if this is a "joined" (continuation) message
  const isJoined = messageDiv.classList.contains("joined");

  const fromName =
    messageDiv.querySelector(".from_name")?.textContent?.trim() || "";
  const dateEl = messageDiv.querySelector(".date");
  const time = dateEl?.textContent?.trim() || "";
  // Extract full date from title attribute (e.g., "26.01.2023 17:29:33 UTC+05:30")
  const dateTitle = dateEl?.getAttribute("title") || "";
  const dateParts = dateTitle.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  const date = dateParts
    ? `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`
    : undefined;

  const textEl = messageDiv.querySelector(".text");
  const text = textEl?.textContent?.trim() || "";

  // Extract reply_to (quote) information - we'll resolve the actual content later
  const replyToEl = messageDiv.querySelector(".reply_to");
  let replyTo: ReplyTo | null = null;
  if (replyToEl) {
    const link = replyToEl.querySelector("a");
    const isAnotherChat =
      replyToEl.textContent?.includes("another chat") || false;
    const href = link?.getAttribute("href") || "";
    const messageIdMatch = href.match(/\d+/);
    const messageId = messageIdMatch ? parseInt(messageIdMatch[0]) : null;

    replyTo = {
      text: replyToEl.textContent?.trim() || "",
      isAnotherChat: isAnotherChat,
      messageId: messageId,
    };
  }

  // Extract formatted HTML from text element
  let formattedHTML = "";
  if (textEl) {
    const clone = textEl.cloneNode(true) as Element;

    // Convert spoilers for client-side handling
    const spoilers = clone.querySelectorAll(".spoiler");
    spoilers.forEach((sp) => {
      const hidden =
        sp.querySelector('[aria-hidden="true"]')?.textContent || "●●●";
      sp.className = "formatted-spoiler";
      sp.setAttribute("data-hidden", hidden);
      sp.innerHTML = hidden;
    });

    formattedHTML = clone.innerHTML.trim();
  }

  const media: MediaItem[] = [];

  // Photos
  const photos = messageDiv.querySelectorAll(".photo_wrap");
  for (const photo of photos) {
    const href = photo.getAttribute("href");
    const img = photo.querySelector("img");
    const title = photo.querySelector(".title")?.textContent?.trim();
    const description = photo
      .querySelector(".description")
      ?.textContent?.trim();
    const status = photo.querySelector(".status")?.textContent?.trim();
    if (href) {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      const thumbUrl = img
        ? await findFileInFolder(allFiles, getRelativePath(img.src, basePath))
        : null;
      if (url || thumbUrl) {
        media.push({
          type: "photo",
          url: url || thumbUrl,
          thumb: thumbUrl,
          title,
          description: description,
        });
      } else {
        // Photo not available - add placeholder
        media.push({
          type: "photo",
          url: "",
          title,
          description: description,
        });
      }
    }
  }

  // Photos
  const legacyPhotos = messageDiv.querySelectorAll(".media_photo");
  for (const photo of legacyPhotos) {
    const title = photo.querySelector(".title")?.textContent?.trim();
    const status = photo.querySelector(".status")?.textContent?.trim();
    const href = photo.getAttribute("href");
    const img = photo.querySelector("img");
    const description = photo
      .querySelector(".description")
      ?.textContent?.trim();
    if (href) {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      const thumbUrl = img
        ? await findFileInFolder(allFiles, getRelativePath(img.src, basePath))
        : null;
      if (url || thumbUrl) {
        media.push({
          type: "photo",
          url: url || thumbUrl,
          thumb: thumbUrl,
          title,
          description: description,
        });
      } else {
        // Photo not available - add placeholder
        media.push({
          type: "photo",
          url: "",
          title,
          description: description,
        });
      }
    }
    if (title === "Photo" && !href) {
      media.push({
        type: "photo",
        url: "",
        title,
        description: description,
        status,
      });
    }
  }

  // Animated Stickers (including unavailable ones)
  const animatedStickers = messageDiv.querySelectorAll(".media_photo");
  for (const sticker of animatedStickers) {
    const title = sticker.querySelector(".title")?.textContent?.trim();
    const emoji = sticker.querySelector(".status")?.textContent?.trim();
    const description = sticker
      .querySelector(".description")
      ?.textContent?.trim();
    const href = sticker.getAttribute("href");

    if (title === "Sticker") {
      if (href) {
        const tgsPath = getRelativePath(href, basePath);
        const thumbPath = tgsPath?.replace(".tgs", ".tgs_thumb") || null;
        const thumbUrl = await findFileInFolder(allFiles, thumbPath);

        if (thumbUrl || emoji) {
          media.push({
            type: "animated_sticker",
            thumb: thumbUrl,
            emoji: emoji || "🎨",
          });
        }
      } else if (description || emoji) {
        // Unavailable sticker
        media.push({
          type: "sticker",
          emoji: emoji || "🎨",
          description: description || "Sticker not available",
        });
      }
    }
  }

  // Static Stickers
  const staticStickers = messageDiv.querySelectorAll(".sticker_wrap");
  for (const sticker of staticStickers) {
    const href = sticker.getAttribute("href");
    const img = sticker.querySelector("img");
    if (href) {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      const thumbUrl = img
        ? await findFileInFolder(allFiles, getRelativePath(img.src, basePath))
        : null;
      if (url || thumbUrl) {
        media.push({ type: "sticker", url: url || thumbUrl });
      }
    } else if (img?.src) {
      const thumbUrl = await findFileInFolder(
        allFiles,
        getRelativePath(img.src, basePath)
      );
      if (thumbUrl) {
        media.push({ type: "sticker", url: thumbUrl });
      }
    }
  }

  // GIF animations
  const gifs = messageDiv.querySelectorAll(".animated_wrap");
  for (const gif of gifs) {
    const href = gif.getAttribute("href");
    const thumb = gif.querySelector("img");
    if (href) {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      const thumbUrl = thumb
        ? await findFileInFolder(allFiles, getRelativePath(thumb.src, basePath))
        : null;
      if (url) {
        media.push({ type: "gif", url, thumb: thumbUrl });
      } else {
        // GIF not available - add placeholder
        media.push({
          type: "gif",
          url: null,
          thumb: thumbUrl,
          description: "GIF not available",
        });
      }
    }
  }

  // Videos
  const videos = messageDiv.querySelectorAll(".video_file_wrap");
  for (const video of videos) {
    const href = video.getAttribute("href");
    const thumb = video.querySelector("img");
    const duration = video.querySelector(".video_duration")?.textContent || "";
    if (href) {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      const thumbUrl = thumb
        ? await findFileInFolder(allFiles, getRelativePath(thumb.src, basePath))
        : null;
      if (url) {
        media.push({ type: "video", url, thumb: thumbUrl, duration });
      } else {
        // Video not available - add placeholder
        media.push({
          type: "video",
          url: null,
          thumb: thumbUrl,
          duration,
          description: "Video not available",
        });
      }
    }
  }

  // Legacy videos
  const legacyVideos = messageDiv.querySelectorAll(".media_video");
  for (const video of legacyVideos) {
    const href = video.getAttribute("href");
    const thumb = video.querySelector("img");
    const duration = video.querySelector(".video_duration")?.textContent || "";
    const title = video.querySelector(".title")?.textContent?.trim();
    const description = video
      .querySelector(".description")
      ?.textContent?.trim();
    const status = video.querySelector(".status")?.textContent?.trim();
    if (href) {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      const thumbUrl = thumb
        ? await findFileInFolder(allFiles, getRelativePath(thumb.src, basePath))
        : null;
      if (url) {
        media.push({ type: "video", url, thumb: thumbUrl, duration });
      } else {
        // Video not available - add placeholder
        media.push({
          type: "video",
          url: null,
          thumb: thumbUrl,
          duration,
          description: "Video not available",
        });
      }
    } else {
      if (title === "Video file") {
        // Video not available - add placeholder
        media.push({
          type: "video",
          url: null,
          thumb: null,
          duration,
          description,
          title,
          status,
        });
      }
    }
  }

  // Round video messages
  const roundVideos = messageDiv.querySelectorAll(".media_video");
  for (const rv of roundVideos) {
    const href = rv.getAttribute("href");
    const thumb = rv.querySelector("img");
    const duration = rv.querySelector(".status")?.textContent || "";
    if (href && href.includes("round_video")) {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      const thumbUrl = thumb
        ? await findFileInFolder(allFiles, getRelativePath(thumb.src, basePath))
        : null;
      if (url) {
        media.push({ type: "round_video", url, thumb: thumbUrl, duration });
      } else {
        // Round video not available - add placeholder
        media.push({
          type: "round_video",
          url: null,
          thumb: thumbUrl,
          duration,
          description: "Round video not available",
        });
      }
    }
  }

  // Voice messages
  const voiceMessages = messageDiv.querySelectorAll(".media_voice_message");
  for (const vm of voiceMessages) {
    const href = vm.getAttribute("href");
    const duration = vm.querySelector(".status")?.textContent || "";
    if (href) {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      if (url) {
        media.push({ type: "voice", url, duration });
      } else {
        // Voice message not available - add placeholder
        media.push({
          type: "voice",
          url: null,
          duration,
          description: "Voice message not available",
        });
      }
    }
  }

  // Location
  const locations = messageDiv.querySelectorAll(".media_location");
  for (const loc of locations) {
    const href = loc.getAttribute("href");
    const coords = loc.querySelector(".status")?.textContent?.trim() || "";
    if (href) {
      media.push({ type: "location", url: href, coords });
    }
  }

  // Contact
  const contacts = messageDiv.querySelectorAll(".media_contact");
  for (const contact of contacts) {
    const name = contact.querySelector(".title")?.textContent?.trim() || "";
    const phone = contact.querySelector(".status")?.textContent?.trim() || "";
    if (name || phone) {
      media.push({ type: "contact", name, phone });
    }
  }

  // Phone/Video Calls
  const calls = messageDiv.querySelectorAll(".media_call");
  for (const call of calls) {
    const name = call.querySelector(".title")?.textContent?.trim() || "";
    const status = call.querySelector(".status")?.textContent?.trim() || "";
    if (name || status) {
      media.push({ type: "call", name, status });
    }
  }

  // Files
  const files = messageDiv.querySelectorAll(".media_file");
  for (const file of files) {
    const href = file.getAttribute("href");
    const title = file.querySelector(".title")?.textContent || "";
    const size = file.querySelector(".status")?.textContent || "";
    if (href) {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      if (url) {
        media.push({ type: "file", url, title, size });
      } else {
        // File not available - add placeholder
        media.push({
          type: "file",
          url: null,
          title,
          size,
          description: "File not available",
        });
      }
    }
  }

  // Animations (in .media_video but different)
  const animations = messageDiv.querySelectorAll(".media_video");
  for (const anim of animations) {
    const href = anim.getAttribute("href");
    const title = anim.querySelector(".title")?.textContent || "";
    if (href && !href.includes("round_video") && title === "Animation") {
      const url = await findFileInFolder(
        allFiles,
        getRelativePath(href, basePath)
      );
      if (url) {
        media.push({ type: "animation", url });
      } else {
        // Animation not available - add placeholder
        media.push({
          type: "animation",
          url: null,
          description: "Animation not available",
        });
      }
    }
  }

  const userpic = messageDiv.querySelector(".userpic");
  const initials =
    userpic?.querySelector(".initials")?.textContent?.trim() || "";
  const userpicClass =
    userpic?.className.match(/userpic\d+/)?.[0] || "userpic1";

  const validMedia = media.filter(
    (item) => item && typeof item === "object" && item.type
  );

  return {
    id,
    type: "message",
    from: fromName,
    time,
    date,
    text,
    formattedHTML,
    replyTo,
    media: validMedia,
    initials,
    userpicClass,
    isJoined,
  };
};
