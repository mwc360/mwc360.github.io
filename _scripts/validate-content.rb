require "yaml"
require "date"

root = File.expand_path("..", __dir__)
tracks = YAML.safe_load_file(File.join(root, "_data", "content_tracks.yml"))
marks = YAML.safe_load_file(File.join(root, "_data", "technology_marks.yml"))
tag_definitions = YAML.safe_load_file(File.join(root, "_data", "article_tags.yml"))
legacy_tags = YAML.safe_load_file(File.join(root, "_data", "legacy_tags.yml"))
errors = []
posts = Dir.glob(File.join(root, "_posts", "[0-9][0-9][0-9][0-9]-*.md"))

unless tag_definitions.is_a?(Array) && !tag_definitions.empty? && legacy_tags.is_a?(Hash)
  abort "article_tags.yml must be a nonempty array; legacy_tags.yml must be a mapping"
end

normalize_name = ->(name) { name.downcase.gsub(/[^a-z0-9]/, "") }
reserved_names = (tracks.keys + tracks.values.map { |track| track["label"] } + legacy_tags.keys)
  .map { |name| normalize_name.call(name) }
tag_ids = []
tag_labels = []
tag_names = {}
tag_definitions.each do |tag|
  unless tag.is_a?(Hash) && tag["id"].is_a?(String) && tag["id"].match?(/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/) &&
      %w[label description].all? { |key| tag[key].is_a?(String) && !tag[key].strip.empty? && tag[key] == tag[key].strip }
    errors << "article_tags.yml: every tag needs a kebab-case id, label, and description"
    next
  end
  id = tag["id"]
  label = tag["label"]
  errors << "article_tags.yml: duplicate id or label #{id}" if tag_ids.include?(id) || tag_labels.include?(label)
  tag_ids << id
  tag_labels << label
  aliases = tag.fetch("aliases", [])
  unless aliases.is_a?(Array) && aliases.uniq == aliases &&
      aliases.all? { |name| name.is_a?(String) && !name.strip.empty? && name == name.strip }
    errors << "article_tags.yml: #{id} aliases must be unique nonempty strings"
    next
  end
  ([id, label] + aliases).each do |name|
    key = normalize_name.call(name)
    errors << "article_tags.yml: #{name} overlaps a content track or retired tag" if reserved_names.include?(key)
    errors << "article_tags.yml: ambiguous tag name or alias #{name}" if tag_names.key?(key) && tag_names[key] != id
    tag_names[key] = id
  end
end

legacy_tags.each do |name, destination|
  unless name.is_a?(String) && !name.strip.empty? && destination.is_a?(Hash) && destination.size == 1 &&
      ((destination.key?("track") && tracks.key?(destination["track"])) || destination["all"] == true)
    errors << "legacy_tags.yml: #{name} must point to a known track or all articles"
  end
end

posts.each do |path|
  source = File.read(path, encoding: "UTF-8")
  front_matter = source.match(/\A---\s*\r?\n(.*?)\r?\n---\s*\r?\n/m)
  unless front_matter
    errors << "#{File.basename(path)}: missing front matter"
    next
  end

  metadata = YAML.safe_load(front_matter[1], permitted_classes: [Date, Time])
  next if metadata["published"] == false

  assigned = metadata["content_tracks"]
  unless assigned.is_a?(Array) && !assigned.empty? &&
      assigned.all? { |id| id.is_a?(String) && tracks.key?(id) } &&
      assigned.uniq == assigned
    errors << "#{File.basename(path)}: content_tracks must be a nonempty array of unique, known IDs"
  end
  assigned_tags = metadata["tags"]
  unless assigned_tags.is_a?(Array) && (2..5).cover?(assigned_tags.length) &&
      assigned_tags.uniq == assigned_tags && assigned_tags.all? { |label| tag_labels.include?(label) }
    errors << "#{File.basename(path)}: tags must contain 2-5 unique canonical labels from article_tags.yml"
  end
  %w[tested_on context_note].each do |key|
    if metadata.key?(key) && (!metadata[key].is_a?(String) || metadata[key].strip.empty?)
      errors << "#{File.basename(path)}: #{key} must be a nonempty string"
    end
  end
  if metadata.key?("last_reviewed") && !metadata["last_reviewed"].is_a?(Date)
    errors << "#{File.basename(path)}: last_reviewed must be a YAML date"
  end
end

tracks.each do |id, track|
  unless track.is_a?(Hash) && %w[label description].all? { |key| track[key].is_a?(String) && !track[key].empty? }
    errors << "content_tracks.yml: #{id} needs a label and description"
  end
end

marks.each do |id, mark|
  unless mark.is_a?(Hash) && mark["label"].is_a?(String) && mark["image"].is_a?(String) &&
      File.file?(File.join(root, mark["image"].delete_prefix("/")))
    errors << "technology_marks.yml: #{id} needs a label and an existing local image"
  end
end

catalog = File.read(File.join(root, "pages", "concept-playground.md"), encoding: "UTF-8")
catalog.scan(/include technology_marks\.liquid technologies="([^"]+)"/).each do |(ids)|
  ids.split(",").each do |id|
    errors << "concept-playground.md: unknown technology #{id}" unless marks.key?(id)
  end
end

unless errors.empty?
  warn errors.join("\n")
  exit 1
end

puts "Validated #{posts.length} dated articles, #{tracks.length} content tracks, #{tag_ids.length} canonical tags, and #{marks.length} local technology marks."
