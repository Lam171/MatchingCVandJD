const $ = (selector) => document.querySelector(selector);
const selectedFiles = { cv: null, jd: null };
const maxFileSize = 10 * 1024 * 1024;
let extractedProfiles = null;

function updateCount(kind) {
  const text = $(`#${kind}-text`).value.length;
  $(`#${kind}-count`).textContent = `${text.toLocaleString("vi-VN")} ký tự`;
}

function rawTextReady() {
  return ["cv", "jd"].every((kind) => $(`#${kind}-text`).value.trim().length > 0);
}

function setStep(stage) {
  document.querySelectorAll("[data-step]").forEach((step) => {
    step.classList.toggle("active", Number(step.dataset.step) <= stage);
  });
  document.querySelectorAll(".track-line").forEach((line, index) => {
    line.classList.toggle("active", index + 1 < stage);
  });
}

function showStage(stage) {
  $("#stage-1").classList.toggle("hidden", stage !== 1);
  $("#extraction-result").classList.toggle("hidden", stage !== 2);
  $("#match-result").classList.toggle("hidden", stage !== 3);
  setStep(stage);
}

function syncPipeline() {
  const ready = rawTextReady();
  $("#info-extract-button").disabled = !ready;
  $("#info-extract-button").closest(".workflow-action").classList.toggle("ready", ready);
}

function showFileMessage(kind, message, isError = false) {
  const node = $(`#${kind}-file-name`);
  node.textContent = message;
  node.style.color = isError ? "#c85841" : "";
}

function selectFile(kind, file) {
  if (!file) return;
  if (file.size > maxFileSize) {
    selectedFiles[kind] = null;
    showFileMessage(kind, "Tệp vượt quá giới hạn 10MB", true);
    return;
  }
  selectedFiles[kind] = file;
  showFileMessage(kind, `✓ Đã chọn: ${file.name}`);
}

async function extractFile(kind, file) {
  showFileMessage(kind, `◌ Đang trích xuất văn bản: ${file.name}`);
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/extract-text", { method: "POST", body: formData });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail?.message || "Không thể trích xuất nội dung từ tệp.");
  $(`#${kind}-text`).value = body.text;
  updateCount(kind);
  showFileMessage(kind, `✓ Đã trích xuất văn bản · ${body.method}`);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[char]);
}

function fieldCard(label, title, body, wide = false) {
  return `<article class="field-card${wide ? " wide" : ""}"><p class="mini-label">${escapeHtml(label)}</p><h3>${escapeHtml(title)}</h3>${body}</article>`;
}

function renderEntries(entries) {
  if (!entries?.length) return '<p class="empty-value">Chưa tìm thấy thông tin.</p>';
  return `<div class="field-list">${entries.map((entry) => `<div class="field-entry"><b>${escapeHtml(entry.title)}</b>${entry.date ? `<time>${escapeHtml(entry.date)}</time>` : ""}<p class="field-text">${escapeHtml(entry.details || "")}</p></div>`).join("")}</div>`;
}

function renderList(values, tags = false) {
  if (!values?.length) return '<p class="empty-value">Chưa tìm thấy thông tin.</p>';
  if (tags) return `<div class="tag-list">${values.map((value) => `<span>${escapeHtml(value)}</span>`).join("")}</div>`;
  return `<div class="field-list">${values.map((value) => `<div class="field-entry"><p class="field-text">${escapeHtml(value)}</p></div>`).join("")}</div>`;
}

function renderProfile(profile) {
  const personal = Object.entries(profile.personal_info || {});
  const personalBody = personal.length
    ? `<div class="personal-grid">${personal.map(([key, value]) => `<div class="personal-item"><span>${escapeHtml(key.replace("_", " "))}</span><b>${escapeHtml(value)}</b></div>`).join("")}</div>`
    : '<p class="empty-value">Chưa tìm thấy thông tin.</p>';
  $("#extraction-fields").innerHTML = [
    fieldCard("PERSONAL INFO", "Thông tin cá nhân", personalBody),
    fieldCard("SUMMARY", "Tóm tắt hồ sơ", profile.summary ? `<p class="field-text">${escapeHtml(profile.summary)}</p>` : '<p class="empty-value">Chưa tìm thấy thông tin.</p>', true),
    fieldCard("SKILLS", "Kỹ năng", renderList(profile.skills, true)),
    fieldCard("EXPERIENCE", "Kinh nghiệm", renderEntries(profile.experience), true),
    fieldCard("EDUCATION", "Học vấn", renderEntries(profile.education)),
    fieldCard("PROJECTS", "Dự án", renderEntries(profile.projects), true),
    fieldCard("CERTIFICATES", "Chứng chỉ", renderList(profile.certificates)),
    fieldCard("LANGUAGES", "Ngoại ngữ", renderList(profile.languages)),
  ].join("");
}

function renderInfoRows(values, labels) {
  const rows = Object.entries(labels).map(([key, label]) => [label, values?.[key] || "Chưa xác định"]);
  return `<div class="personal-grid">${rows.map(([label, value]) => `<div class="personal-item"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join("")}</div>`;
}

function requirementGroup(label, values, tags = false) {
  return `<div class="field-entry"><b>${escapeHtml(label)}</b>${renderList(values, tags)}</div>`;
}

function renderJobProfile(profile) {
  const job = profile.job_info || {};
  const description = profile.job_description || {};
  const requirements = profile.requirements || {};
  const requirementBody = [
    requirementGroup("Kỹ năng bắt buộc", requirements.mandatory_skills),
    requirementGroup("Kinh nghiệm", requirements.experience),
    requirementGroup("Học vấn", requirements.education),
    requirementGroup("Ngành học", requirements.fields_of_study, true),
    requirementGroup("Chứng chỉ", requirements.certificates),
    requirementGroup("Ngoại ngữ", requirements.languages),
    requirementGroup("Công nghệ & công cụ", requirements.technologies_tools, true),
  ].join("");
  $("#extraction-fields").innerHTML = [
    fieldCard("JOB INFO", "Thông tin vị trí", renderInfoRows(job, { title: "Vị trí", department: "Phòng ban", level: "Cấp bậc", location: "Địa điểm", employment_type: "Loại hình" })),
    fieldCard("JOB DESCRIPTION", "Mô tả công việc", description.description ? `<p class="field-text">${escapeHtml(description.description)}</p>` : '<p class="empty-value">Chưa tìm thấy mô tả tổng quan.</p>', true),
    fieldCard("RESPONSIBILITIES", "Nhiệm vụ & trách nhiệm", renderList(description.responsibilities), true),
    fieldCard("REQUIREMENTS", "Yêu cầu bắt buộc", `<div class="field-list">${requirementBody}</div>`, true),
    fieldCard("PREFERRED REQUIREMENTS", "Yêu cầu ưu tiên", renderList(profile.preferred_requirements), true),
  ].join("");
}

function setExtractionTab(source) {
  document.querySelectorAll(".extraction-tab").forEach((tab) => {
    const active = tab.dataset.source === source;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  if (!extractedProfiles) return;
  if (source === "cv") renderProfile(extractedProfiles.cv_profile);
  else renderJobProfile(extractedProfiles.jd_profile);
}

["cv", "jd"].forEach((kind) => {
  const input = $(`#${kind}-file`);
  const zone = document.querySelector(`[data-drop-zone="${kind}"]`);
  $(`#${kind}-text`).addEventListener("input", () => { updateCount(kind); syncPipeline(); });
  input.addEventListener("change", () => selectFile(kind, input.files[0]));
  ["dragenter", "dragover"].forEach((event) => zone.addEventListener(event, (e) => { e.preventDefault(); zone.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((event) => zone.addEventListener(event, (e) => { e.preventDefault(); zone.classList.remove("dragging"); }));
  zone.addEventListener("drop", (event) => selectFile(kind, event.dataTransfer.files[0]));
});

$("#extract-button").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const sources = ["cv", "jd"].filter((kind) => selectedFiles[kind]);
  if (!sources.length) {
    if (!rawTextReady()) ["cv", "jd"].filter((kind) => !$(`#${kind}-text`).value.trim()).forEach((kind) => showFileMessage(kind, "Hãy tải tệp hoặc dán nội dung trước.", true));
    else button.innerHTML = "<span>✓</span> Văn bản đã sẵn sàng <b>→</b>";
    syncPipeline();
    return;
  }
  button.classList.add("loading");
  button.innerHTML = "<span>◌</span> Đang trích xuất văn bản…";
  try {
    await Promise.all(sources.map((kind) => extractFile(kind, selectedFiles[kind])));
    button.innerHTML = "<span>✓</span> Đã trích xuất văn bản <b>→</b>";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
    sources.forEach((kind) => showFileMessage(kind, message, true));
    button.innerHTML = "<span>!</span> Trích xuất không thành công";
  } finally {
    button.classList.remove("loading");
    syncPipeline();
  }
});

$("#info-extract-button").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.classList.add("loading");
  button.innerHTML = "<span>◌</span> Đang trích xuất…";
  try {
    const response = await fetch("/api/extract-information", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cv_text: $("#cv-text").value, jd_text: $("#jd-text").value }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail?.message || "Không thể trích xuất thông tin.");
    extractedProfiles = body;
    setExtractionTab("cv");
    showStage(2);
    $("#pipeline-match-button").disabled = false;
    $("#pipeline-match-button").closest(".workflow-action").classList.add("ready");
    button.innerHTML = "<span>✓</span> Đã trích xuất";
    $("#extraction-result").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
    button.innerHTML = "<span>!</span> Trích xuất lỗi";
    window.alert(message);
  } finally {
    button.classList.remove("loading");
  }
});

document.querySelectorAll(".extraction-tab").forEach((tab) => {
  tab.addEventListener("click", () => setExtractionTab(tab.dataset.source));
});

$("#pipeline-match-button").addEventListener("click", (event) => {
  const button = event.currentTarget;
  button.classList.add("loading");
  button.innerHTML = "<span>◌</span> Đang đánh giá…";
  window.setTimeout(() => {
    showStage(3);
    button.classList.remove("loading");
    button.innerHTML = "<span>✓</span> Đã đánh giá";
    $("#match-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }, 550);
});

$("#back-to-input").addEventListener("click", () => showStage(1));
$("#back-to-extraction").addEventListener("click", () => showStage(2));
$("#go-to-input").addEventListener("click", () => {
  showStage(1);
  $("#stage-1").scrollIntoView({ behavior: "smooth", block: "start" });
});

syncPipeline();
