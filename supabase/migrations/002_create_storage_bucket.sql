
-- Create storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true);

-- Create policy to allow public uploads and reads
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'chat-images');

CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-images');
