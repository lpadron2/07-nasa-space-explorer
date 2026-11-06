// NASA APOD API settings
const apiUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const apiKey = '6kMBcRbffFrN8NmgzQCcd9gBGn7ww6Njgb7Fcpqh'; 

// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const getImagesButton = document.getElementById('getImagesButton');
const gallery = document.getElementById('gallery');
const imageModal = document.getElementById('imageModal');
const closeModalButton = document.getElementById('closeModalButton');
const modalImage = document.getElementById('modalImage');
const modalVideo = document.getElementById('modalVideo');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// Fetch APOD data for the selected nine-day date range.
async function fetchApodImages() {
	const startDate = new Date(`${startInput.value}T00:00:00`);
	const endDate = new Date(`${endInput.value}T00:00:00`);
	const numberOfDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

	if (numberOfDays !== 9) {
		gallery.textContent = 'Please select a date range of exactly 9 consecutive days.';
		return;
	}

	gallery.textContent = 'Loading space images...';
	getImagesButton.disabled = true;

	try {
		const selectedImages = await fetchSelectedImages(startInput.value);

		gallery.replaceChildren();
		selectedImages.sort((firstImage, secondImage) => firstImage.date.localeCompare(secondImage.date));
		selectedImages.forEach((image) => displayGalleryItem(image));
	} catch (error) {
		gallery.textContent = `Unable to load space images: ${error.message}`;
	} finally {
		getImagesButton.disabled = false;
	}
}

// Fetch one APOD record for each date in the selected nine-day range.
async function fetchSelectedImages(startDateValue) {
	const startDate = new Date(`${startDateValue}T00:00:00`);
	const imageRequests = [];

	for (let dayOffset = 0; dayOffset < 9; dayOffset += 1) {
		const requestedDate = new Date(startDate);
		requestedDate.setDate(startDate.getDate() + dayOffset);

		const year = requestedDate.getFullYear().toString().slice(-2);
		const month = String(requestedDate.getMonth() + 1).padStart(2, '0');
		const day = String(requestedDate.getDate()).padStart(2, '0');
		const datePath = `${year}${month}${day}`;
		const requestUrl = new URL(`${apiUrl}/${datePath}`);
		requestUrl.searchParams.set('api_key', apiKey);

		imageRequests.push(fetch(requestUrl).then(async (response) => {
			const image = await response.json();

			if (!response.ok) {
				throw new Error(image.message || `NASA could not return data for ${datePath}.`);
			}

			return image;
		}));
	}

	const images = await Promise.all(imageRequests);

	if (images.length !== 9) {
		throw new Error('NASA did not return 9 APOD results for the selected dates.');
	}

	return images;
}

// Create one gallery item from an APOD response.
function displayGalleryItem(image) {
	const galleryItem = document.createElement('article');
	galleryItem.className = 'gallery-item';

	const title = document.createElement('h2');
	title.textContent = image.title;

	const date = document.createElement('time');
	date.className = 'image-date';
	date.textContent = image.date;

	if (image.media_type === 'video' && image.url) {
		const videoLink = document.createElement('a');
		videoLink.className = 'video-preview';
		videoLink.href = image.url;
		videoLink.target = '_blank';
		videoLink.rel = 'noopener noreferrer';
		videoLink.setAttribute('aria-label', `Watch ${image.title}`);

		const previewUrl = image.hdurl || image.thumbnail_url;
		if (previewUrl) {
			const videoPreview = document.createElement('img');
			videoPreview.src = previewUrl;
			videoPreview.alt = `${image.title} video preview. Click to watch.`;
			videoPreview.addEventListener('click', (event) => {
				event.preventDefault();
				openVideoModal(image);
			});
			videoLink.appendChild(videoPreview);
		} else {
			videoLink.textContent = 'Watch video';
			videoLink.addEventListener('click', (event) => {
				event.preventDefault();
				openVideoModal(image);
			});
		}
		galleryItem.appendChild(videoLink);
	} else if (image.media_type === 'image' && image.url) {
		const imageElement = document.createElement('img');
		imageElement.src = image.hdurl || image.url;
		imageElement.alt = image.title;
		imageElement.addEventListener('click', () => openImageModal(image));
		galleryItem.appendChild(imageElement);
	} else if (image.thumbnail_url) {
		const imageElement = document.createElement('img');
		imageElement.src = image.thumbnail_url;
		imageElement.alt = `${image.title} video thumbnail`;
		imageElement.addEventListener('click', () => openImageModal(image));
		galleryItem.appendChild(imageElement);
	}

	galleryItem.appendChild(title);
	galleryItem.appendChild(date);

	gallery.appendChild(galleryItem);
}

// Show the selected APOD with its full details.
function openImageModal(image) {
	modalVideo.pause();
	modalVideo.removeAttribute('src');
	modalVideo.hidden = true;
	modalImage.hidden = false;
	modalImage.src = image.hdurl || image.url;
	modalImage.alt = image.title;
	modalTitle.textContent = image.title;
	modalDate.textContent = image.date;
	modalExplanation.textContent = new DOMParser()
		.parseFromString(image.explanation || '', 'text/html')
		.body.textContent;
	imageModal.showModal();
}

// Build the direct MP4 asset URL used by NASA's video records.
function getVideoSourceUrl(image) {
	if (image.video_url) {
		return image.video_url;
	}

	if (image.hdurl) {
		const sourceUrl = new URL(image.hdurl);
		sourceUrl.pathname = sourceUrl.pathname
			.replace('/dynamicimage/assets/', '/content/dam/')
			.replace(/\.[^/.]+$/, '.mp4');
		sourceUrl.search = '';
		return sourceUrl.href;
	}

	if (image.url && /\.(mp4|webm|ogg)(\?|$)/i.test(image.url)) {
		return image.url;
	}

	throw new Error('NASA did not provide a playable video source.');
}

// Play the video in the modal using NASA's direct MP4 asset.
function openVideoModal(image) {
	modalVideo.pause();
	modalVideo.removeAttribute('src');
	modalImage.hidden = true;
	modalVideo.hidden = false;
	modalTitle.textContent = image.title;
	modalDate.textContent = image.date;
	modalExplanation.textContent = new DOMParser()
		.parseFromString(image.explanation || '', 'text/html')
		.body.textContent;
	imageModal.showModal();

	try {
		modalVideo.src = getVideoSourceUrl(image);
		modalVideo.load();
	} catch (error) {
		modalVideo.hidden = true;
		modalExplanation.textContent = `${modalExplanation.textContent} ${error.message}`;
	}
}

getImagesButton.addEventListener('click', fetchApodImages);
closeModalButton.addEventListener('click', () => {
	modalVideo.pause();
	modalVideo.removeAttribute('src');
	imageModal.close();
});
imageModal.addEventListener('click', (event) => {
	if (event.target === imageModal) {
		imageModal.close();
	}
});
imageModal.addEventListener('close', () => {
	modalVideo.pause();
	modalVideo.removeAttribute('src');
});
