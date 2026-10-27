
(function () {
/* =====================================================================
   RPI (Rumah Pelopor Indonesia) - Laporan Kunjungan Relawan & Dashboard Donasi

   SKEMA DATABASE SUPABASE (PostgreSQL) - jalankan di SQL Editor:

   create table profiles (
     id uuid primary key default gen_random_uuid(),   -- produksi: references auth.users(id)
     full_name text not null,
     role text not null check (role in ('owner_admin','coordinator','volunteer')),
     phone text,
     created_at timestamptz not null default now()
   );
   create table donation_categories (
     id uuid primary key default gen_random_uuid(),
     name text not null unique,                        -- Zakat Penghasilan, Fidyah, Sedekah, Bencana, dst
     is_active boolean not null default true
   );
   create table donors (
     id uuid primary key default gen_random_uuid(),
     name text not null, whatsapp text, address text,
     created_by uuid references profiles(id)
   );
   create table volunteer_visits (
     id uuid primary key default gen_random_uuid(),
     volunteer_id uuid not null references profiles(id),
     donor_id uuid not null references donors(id),
     status text not null check (status in ('Prospek','Berminat','Menolak','Berhasil')),
     notes text,
     visit_date timestamptz not null default now()
   );
   create table donations (
     id uuid primary key default gen_random_uuid(),
     visit_id uuid references volunteer_visits(id),
     volunteer_id uuid not null references profiles(id),
     donor_id uuid not null references donors(id),
     amount numeric(14,0) not null check (amount > 0),
     category_id uuid references donation_categories(id),
     payment_method text not null check (payment_method in
       ('Cash Relawan','Transfer BNI','Transfer Mandiri','Transfer BSI','QRIS')),
     proof_url text,
     verification_status text not null default 'Pending'
       check (verification_status in ('Pending','Verified','Rejected')),
     verified_at timestamptz,
     verified_by uuid references profiles(id),
     created_at timestamptz not null default now()
   );
   create table app_settings (
     id uuid primary key default gen_random_uuid(),
     org_name text not null default 'Rumah Pelopor Indonesia',
     org_logo_url text,
     bank_accounts jsonb not null default '[]',        -- [{bank, number, holder}]
     receipt_footer_text text
   );

   -- RLS wajib aktif di produksi, contoh: relawan hanya melihat/menulis data miliknya,
   -- koordinator membaca semua, owner_admin membaca + memverifikasi donasi.
   -- alter table donations enable row level security;
   ===================================================================== */

const { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } = React;

const SUPABASE_URL = 'https://fgzllccotccxogncpsgs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_nzb3wHiuXwWJksFaYkoOrw_Bq8pVVmz';
const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAADGCAMAAABfC00XAAAAkFBMVEUAAAALCeUH/Qjw8+8qMUdT+VNy/HIG/gZWVPOl96Vp+WpwcPgHCPuL94yi9aJSWGqgn+5oZvKoqPEFrUsGS6dubnAaZGuSj/Glp6rS2+Jt+G38sv6XmqRoaepkZaj/AP8iWTiQlZ9aYHAhKT5yd4ZisGITE3AbG7VBPfT/ff///wD6/LIasxxD/zdudIMSoyY45H/iAAAAMHRSTlMA/vsR/dgFAuEZpgUDlWLwXqYU/v8E/ZYTT1oKXmYIAf6VpvuiAwMD8QQBBgPZ2f5MQ9YOAAAY0ElEQVR42u1dCUPyOBMOZnuX2ta3QhFw9fXG1f//7765kqYFFFSg+DG76ypHmzyZ48kkmSp1kpOc5CQnOclJTnKSk/xG0ZGPcpib060jfWyYRf83N/2GXoFmoehDqTXfXB+JQg29MxBPB3tvMNyS7z08EhXzFbX37Czbf4MjlfG9PeUfCVjx4cGKT2CdwDqBdQJra7D8/d/7WMGq9QGkPjKwtFAHL/b2LrG5tz4KsO6VPuuBaGjIMVhh1gewsmOwQ+3ruA9gxdCQI1As47IOK54+AtWyVvgV9wzft785Hf9vtXS/inIBcjx2GFyzFQ5XxfUr+NdK900w4Q4LqOmKVyrPczUSUaowEoo8PQ1aooQ8BEeQzCIrVJl6XfmBl0aAb2sEYgYC78wsCvg5AWLwFTF2qI/ECj2tx6AauQjA0VaHwS7l4kjsMBD6Hl9VerRbSNbLn+Oww8DEwkypfHAwMXYYHAVx8HSlw8OBdXEU5CEQlxVrNTocVmKHWc8161Vc1lAdUrHEDuM1AblnxAEsoDgkVoP3IyAPxgq9Q3p3lMv+2yGs2hn6Hh4WLCEPz4HuvRWe6QMr1jGQ+MjS9/DQYF0caslk6+z7QWlDyw6v/R67LLbC+ungYBk77K3T8lUksfDwWIkdRr0l8YGasBX2ACuxw0lfyYNviEPYB7AkA6gDv6exMPJ6o1hmMh31NB76monDZT/AEhLf08VWY4U90Sxrh33E6trQ90FPxJD4fsZCJg4XfQHLkIegx/T9T1/A+tPf7TS6b1bY58l0pOp+WaGxw7qH5MFXw35ZobHDYf/sECJ036zQ2KHq3WQaDoD0zQqNHeq+2WFklu3/9AkssyLmR73awKbsrqyLHondqaV6c6QO5/X92O23fhcg5kR6kZgBqIZn/RY11Dyoh4dq4p31Xjx1aLjwZK/OjgAqgitDYzyY77oP2lBd/OmhXLThCu4PZYE6c/z6hRr0UlQXLv8AhF2pllb1FKpluChNuVdeBVoVuVr1Z9BrcY0xBlf/uj/eFYFaHRNUS3ABoQ+i/YVAl4MeAVTN3EfgqvcSGNFZ6dg7Oqg6cHlI6nfsupiDnh0lVF3tmuyWpRJUmXe0UDWriaxdO5wDUWrBndl4anCM4vKIyY5IfZeuHylUXbh2wVLBAq9dqNQwHByxtOB6/lG4aLtAW6vUUWO1gtT/kDHq7iRQgeoOjl5cuGIyRv0zdN2FChJDuhj8BmmR+uz6+6Se2ELcztCW4eCXyJ/3dur5W75L33ehipTKB79I/nQy9ff6x7Qqela/xARXwqW+rF3EQYeeC9WVUjoc/Drpknp//G26jvFV5b8Qqw5c25P6qMMWkOjCIdXR4LdKl0dEW2yI6cxsMjpt/Ovc1XqWeqU223pDHLSOu0tI6vqXmuBqlqo2YqkA1XNLq9DlvSLMeTFzy3RAoY7frV04Zbz+xFddudn1M4oOEdY6SazqLRVBMWUusOyHQVPu/3TEpB6i/ye+K+rQdRUY2fpw9gsiiTiqGQmUk1HdMjJhr0l99HEFi7htgFtV25N6PM8g8JN+W6fG7nfsizlW5UHdxB+mJM/TYbVLrztz4MvZm7Ovl3Takdgm2p1Xl7uSi0sXLDz7sw6sydlJOjJZwyFOYJ3AOoF1AusE1gmsE1i+8r0TOp2NqOtrHaxm5pHduR19t6R2ZM8WePobF2va880WNV0brrvU1ilm27gfWFnzTBLkG2ImZT+wkGzB+sJZiZXSjKT7auScWQj8yN9MLFi69fJGj2my7bFgbXZLPwjW9bDRrKvVnd/2XEZw1WhW0Nr/p7MJSJZtvCjSTD9j3T4FO/lQWqdRA6sO/iZlzGmRKuKWolW5I+M3mnX9M8dVVoFF6xm2UL0XZ5Ih/BpYkfr45IHXKu20FVi48pJBEX+z4Y/WI/YLFixeDFX7LFGmNjiLvB6sz4q7fxEswKXunMGaOOVL9wFWsEoT4g3Kgu4brPtVZ7BAT81u0t2DBTnT7IsV2PcMlr/maF/WWMiuwfKvs3X16j/b/7tfsPxgXR3/TPjTzsEyJcUIHucnF5zQPQIraGyQ76ocI9B7Asu3kWUoT22ZxKZOdq/AuorNE+lYxWIbwaX8+d7Awu4ODbGXxvQMrGcCy6ub9jVN3jdYRs2jIIh6DVYgE4c4MJR972CZYaLT7SfN+tDBxzqT7VsxTHh6Cda1gGV2BHnDTB8GLK+1yKj6CJakJ9qroQcBa1X9hH6CtUJOYJ3AOnaw/BNY24MVZ/xGNvE2BUtbsJ5VBbLhU/7s84bwO6/XNlOqN6EOuKs2k2htUnD7J6VabqXNFtS1YOnxmICplnLwvG5QfQKWqiJ39aDRLLjoQ1WNx/ojnpWZeoQTpQ9GSs0bUbBmugMYAUjzhwdn/cjkLPMpvXBzc3cLcn757wdyeY6fubu5oa9M82Z1x174ATAD0FqoNaRU0g9xEBxuumM1a2m6AyDNx23Y5tPpVEF336X/5+eXl/9sLZf4xXO6xPsFXA4uOu8o1hxA60x37GAebrrTgNVMdxKNjqWxsfFcoe68nZM46Pz9+89XxfnmJV/3DfVOzceNpaI/fF2e7viHmu6sBMvAlE9vbm7PEaNLA9E34PkIub8GNgTu7RyMdZprd4ERpjt9Asv47VhHYz1Vd6xFl/8cRNhQz+/UVHPDe6JZz1az5AmQCpv5T08E2/L+3tKssX+giXT8/Ho9lMA+vbv4999lj/KZAf3t/t15afmVbWz5r9U0cGhCHUyT969ZtM70/n65jcX9tcYivnl7ubS3+7u5aQI1eX9XuaGGMiXYKVhaJdWrgKUUxLjLjZwvDe+lhK5b4kxAsECmJONGytLZyqPK0nmLP0tfU8TNbiXAXrrw/f3MMpXxHBgwnb0OO9As4gMR6tO/n6iT1Zy3t7tbhXxoTFS7ie5fPGGrHe6PnBdRhIG7e3s7X+Inq1sGDO0m53Zc7w6sBTRvCozgcj3zEYgUaU1dr9zi9FDhHAVofYW0u5pXJHMQZLOuAMMEkffxxwN87QG+h/+u2lxW16R9iiiL086/yyp2ezMd6x/XLN+ChdTpfIULtcQQJyP1So0BDSCqmqofFLpYNbYkuA1ejROqO7FWS/ZaiN3emKVEdfUDYMGA8sQVDe+87Ywuafju7pAHjpWjQQ/oD+bogSq1N0HkKvRyqILKnY4qMIebu7u3RtscS0DHz5vZqKtfFS0jpmuYz7XuQar0BrRvWo1bZkaz2Sr9yu7CHxVoQIoa5xorurgK3Nvd25JjAy+mxCCq6gtNT8wdpneu5RFKoEg1PFJbdyav1cExWokatmzeegmeBg6q9tYm0GAiU9P+ZJs7sBcAoG7MEJAuQVCbu3iw461+EiFdWtHOS6gpaXr9rdHQ0lwXNgDxttEz6KRiwMA+NrvTmIZBT41KYWwDtzR1Grou27a5AABJkibJB5dJ5U36+ZiiJCCOa/86buNx5UA2ZYd2bhRsSrecjz+/DCN1S0wZGaSaNm4J/Oa3UCofE+p0uv4JK7qG8A+Uo8Z7JpYSLCEp4I2/h9mDqhqHBu7slnt9fst4fdRZGck7yqxArmM6tY4JWc4XYNKoPavjOp6qLkZlyz+UUGWjkQLmC/APvyTHhUf5xw4FlS/d2jznFjJguDeUNIFcT/kxdYZoP32Dz91OHaZdKVdpN8BnzeV1qvMZn+ed2Sot7b4n7eeThjV8SY1a56hDbFiKJSYAQDVrga2TR9a6ZOtxBcfyUDkzgynm4t5gIjZf180azyjfTO2dHjDAbaVH6IgaI4NOlUmeL/iGwMRMjbLCgBXmqmxrFpd8k6PRIepW3q5sVisgbwsDYOGAhVDBHEO/AF6lw7K2iZ3V2JINcGXwc1SvWYKpazHSh21ZgBZH0tbbhLQilNHX6WJkINIzqj5S1FdLaj4ildJccmMEnryiqi5PIzjDH9JLCVzJVOQYNWDBhcoZKm4xKxd2DNLHNCkftlM15BsP4tUAkw/0EbjcdoORzMFLJBSgNBga+BXZg6gfWIFGCxPWSupjiH9q7viy0yGwoKt1SCqYanlJq3xG1qcJCPp+ASmXymqlUyqH3B1HDHn7cdtYoNdNoxy6tgVKTgRf4K+LgofbqFIpBaRC3Qx/QX+nZUpvKb3krXUHLLRlBgu+MYL/wJGVCr6PhjprecSi5drwnhVcLlR5KXaSfCFe6vK7zHFcJkB8MLZDO/IR1LTAIbSOqFRzbpsUcRu9SDMT6fdioQSs5YuLGXLXwQzBE/FLI/xzVNBiRKI1hQcbalOx8TBPypGghSpYy/iFEEfbS5plonYuGuBJRbPQC1nfUVpojBWmqrBRTYLKC3VkhCRgYAxyBVgDKSUS6odSPzYhcqStzdXtWAoDg6r2lOMfOX8WaEurMhMM4thEIvAcEDTLXeI0FxKjS/BNI93AgaZlwZIeJKQ9FMpAF1+Yd7crcK0Fy/bu0cGc/X2aEFgjjqUmsqfaBARoog4d43dKFMLnH2UYxY0ku5rMCtkD+y9o3EMc11lhVQvbT35GpdowzMFTXbRUqwPWYnn+bj5BpFRbBQ1Rh7mPqf0YqQq2S3wAekPj5Aa5NJp+z0WTsWn4eWh3Uczgj+edzeDBPSmI+9aPY8I8b5SE9QhatLBqFPLIFkxVxYsVszwvC+NYVoAVAl8zE2kAi3GocUR0CGOUYlxgsBKOMWCWTzbOiv6ihmurZWyPOc0JGtssmtjTzNy/bnnJY1JRzyGuMEhwLw5UjzRKGKCYBsAvDBbF9pTaFLJzEu8iYNXWkWs17qqviYaGWSZGacoizNHnKQKrkLALlyzyUnxYgWYG7SKwZg1YhXES8FrZqrMa5tZpYJQo069nS5hlopdIbWQOMdVfkLVVZJShUSi0FTPexKrcRpEBzFkPIYjNOS7WabkyGmqbc0DVKwgH4RXYPdBTVsyEoAQrF7BeAKxKzJA0i5Gead1olhhGkRdPTWsVEgyeKm2vYWlpXDl+uSSlMKTpkWxFtKLCrlBMVMjIuUUlvWEMtBnBJC0tFyVaXncNvRTmnlsDlZfC0WhUiF+it8TqmKfOjfo9WFWkZojGgf+Txj8Kkohv28+F4sSa3NCGMmag8oLAL1hVS1ELhA9/Y3N/JLByBqVYNOFwzmpQJtrwHrwo8R4cRZmvFK2ZcGJrexpvppcqo5LCCIBQyCx09QU9wItcJJScxaBjcwZJTI1xh6BhlvcUwuO2s8G8aKqmPeU8ndFybabmxg2NmolxoewchXs5agYaW6GFloWzemXawYmF68BiRSg6iYh0LqFDGYXB2UGqW1wFHIhBJVxAE2UaUaCvUqX9YIif2xitVKa53RamBoqK2kOY8NiF0vqRuBKwwQSj10DV5bwsmv7bZAGDBdyzndBSpWQHE+2EYCKxUq4N59EdAJFtpeKUirqsC4t2xZ42rBO4SM7zs4Id/aMdxoLnl+41oVWbevpHy7zDIh+F1jEK4dGKgxGHXVJ6mrjRx+gTYGXWxdWOsqQYUTErgL4kp8x6MxHeMB3AU9EcJ+xS0jKkODRuI8i5H23h4GQK/P+FHT2Sj7KxXfu7hHyH7n4K1iwc2BCfW2MBCsrhQ9NvTJHnKSgJjASPoGgROtqZseC8wDJ+s1lOFLOb+km7GcK0m3jGtIZ6BKEX0259k1qbnIaTdUAyhnrKPg0MDV0Ufe5FSHIprJkG0Tq33BDHQm+8WgkZO1JWbPTITh1KCxz95g7eqGYC1bhnzAZjFrhspd/YxNJkznOnZNs8k/kCJxnbyXzMZ41I3YpclF7IC6h60zcBa4xDLn4uTe2UAC9JA55sbIjGmi3Oi5LmGJrD0SNFZFJVzFGx48AQTmCBmeWsQwv1IhA9PvKs9WvVXdbaJPD8eVm68zEgHyXeoaRe2MGrTTJwbgdcz4U6jsA9WH+soWDolmAZ0icWXCwoNNkJGLMksnUbvwrQpJGGWJ7ohaNH+KXk07UOTcVZok45Fah3Ukldlc0eGgcsSmBLWIsoppNbs4vG0ocFYpGLxZLHY68BqZzQYTobqtbIZTZCEB9YQ4uS4myxSLRM/8EplapJVidzonZVmuoVh7yXVcsUfPn0qZZQVIZQxP+txk8v2zYuJJUuleM+gNE8MeuHViZp5/kJ+RYrk2WLzEEaCfRdN06gyUUCn5txVi2lP9aniLiyDxfTbZ3Rp9LzUZZh7yMz/vB3FoEEGn8iwMHajVqsm3rlwtjSGmVlSLJJ66J7N2mgookP1cvmFF60lTMbNjaMm+r5rXWZFF12Wa6qBAPG1O7mtb5uddTHEsWeeTIcHzqAbdCeFGoamiIfPoA6gc3a8TAju3Tx41sEgV5RKSGFte95eyHXqT/OaSDpbrFgnwujn27jWRPjnoQLjHIk4BhAcEQg4FjaBrGtbA8fFXsKXt3bQT+ibDiMQaCgbTxsOlq5BVBM4RPfHOeC49dNxYjOIS9bNI38ad227mh9NSeM6zw9eTJcHQgI+3eyJ23WqdTGxNRwKmcCQiwebD2v9YrdBstliMFvZxM1iSgF7XUeU+yboh6x7FA1Zawwkio5b3Y24dPNUBboXlt9O+vUK9NYxgjGAAbETZChweuVcYAmBjD8HDZp0VtYlmSDtl13L5nplsbyQjMXVCZt0/IY7HblL/A4WKsqtibkq26hEy4HE0TaHuCng2VS/EkrOSbnRbjrM7Y7IXg7Ox90hi9FtAAzbMqCxKxtGv3cp0lfJdb2MrK+mVQkT7emN6yoBWcKwJBLmdo6WUzH7zguwZzJv/IsWFgXiVEBxx1L3ZoIv1h73G04r5UJAoGjcFCLL6Yybnjt54AuGSPFig2wze5sU2xCkR6DpsUT3ymPpt1SctiLxKT6XowTKziChR1d+EQegGs+2ZUIPUs+oZK6zibgj3DsbTfPGBYz1qxbWFqPP4Cvm3NlQ/ydS6D8R+cwGSzGMbbXkPKKUCPBo4vQ1/h03ERHE89oG7zanFh9tcdayTLX8NuSFhNmJvust9lKbakDrhqUH2+2GOMzWj27FR9ilvXO3NFALJU6GvnSZeyWKdmUsZbFDJzVLEXwLoE1RLuLMo9UVrNu4oNu8E1QWJ9KoXkmQNxbja/18wfbURe6hD09L3lrnXhTsGBlpshLXjD6cNeZU06TT+dGRrdi7L7UidKMi6detaCSEVgen0SK8JEQrGX61YA1zKRihGqBhRrnRTLntMdywLfXjSqxH8sah+9jER8vXl20CtcRZXlsIenYTbMOQkaEa+oNPjs0Dpfk1VTS9erMuGGk7rHUYhLvtASWmOR1Axa/y/bWGha+l8+U1h6EBoRElQgat7ynHFkHjKO1WTz0+7SspsLRVnYoG8M2mvXCZ67YsIKm7LDHrng1WEM5JG7UImtpljVDQ0k7YHmkr/pKcdLOCbRD21xxbr59kIk2juL1s8xnuv3xD73NKgcfgTFl7GgUud6Kag5gBeYzkdUs31S4Qi5qOKfj4IemixYs9k8wNHCdITyPgyKfbmrVQSmvyI0mTfFLObE+fH7dYPkv3eU+CF9nfHoosn3yomG7JoMBy49Ex9D2ooYv+NbvQw8r0SyhUAKW79OnJ36MmuXx6MAH4+ZRXTFVABWwbIEDvrYnB7s32AeY7hCsyHqhxudOjHUMO5oVkCNmx69tyTRlLTLg3AT5LHnRXIJvE1Euy6Oes2VmWF/WKbkW8S2cOoix6Hq8aka+X5EjiC2wMlOFRbiD9LSWbokrswFuMhHUaC7MD5XyhlHDwygVwYYK+YiJaA7TLCxGYAIgWTHdyzOa5RN2WcYe/tAHGwI+Ix3bFAtGMHPiKtY0DRJT9Swl06KU7vNrYgpmjc8WrzVkdekUR8WAIp7Oq41TF81yfShTPE8LIQsODpb4G8mwkI0Yw6LKjUF7coiDHlhOO3Eelsdwa5uZkXkNq4u3VHPF1paI0ZMJKQ2YTnhicuLdPXum/NBoXUtLK1v/xKsb761bAR4eOqSdGp2oCVgmmrJ/drkwkkyzhil6FIn6TiaU5Yn50UVosbo9NRSfrpXX1AaKWtVKN/PwuwWLbIyrf2KnWKWujDVQjI8xcTfEjCh+SLcfvmwKkK/SWleu3LL2TEwzFWeek/lxSLJm+GOaNalWhdKD2mHGdhThWGdN5VRKMy01rzuf5YSqm+aUh7nRbzaNF/j21Q5vBO4Qc0VuwxPEiu8V5IuEzDMd0yo6uGLZ3NUruWzQIvBAgTKDa/r/uulKzSfbrjFh5UAfyLZHYaSmonhmkZtgfob5hH9gsNyxhHQyZI5kDaeijPLO746P+wzwKQI25YJeMI6jZjoZG+McHtzD4wQElxIiN6nrs6Pe3zHMjp/DVzBbEzP7qD1ThFpVBz8x6rT1HtdHD+hHwQcqx7ehojUs7fPa4nvxXL5/H6j+CKMVSJuwfByVof601t7uxzLo3fFot3FB5IttXuvDc4djkAifKROccNjCtR6cOZzkJCc5yUlOcpKTnOQkJ9mT/A8N8iC+et0BBAAAAABJRU5ErkJggg==';
const LS_DATA = 'rpi_demo_data_v1';
const LS_DISMISS = 'rpi_install_dismissed';
const LS_INSTALLED = 'rpi_installed';

const SCHEMA_SQL = `create table profiles (id uuid primary key default gen_random_uuid(), full_name text not null, role text not null check (role in ('owner_admin','coordinator','volunteer')), phone text, created_at timestamptz not null default now());
create table donation_categories (id uuid primary key default gen_random_uuid(), name text not null unique, is_active boolean not null default true);
create table donors (id uuid primary key default gen_random_uuid(), name text not null, whatsapp text, address text, created_by uuid references profiles(id));
create table volunteer_visits (id uuid primary key default gen_random_uuid(), volunteer_id uuid not null references profiles(id), donor_id uuid not null references donors(id), status text not null check (status in ('Prospek','Berminat','Menolak','Berhasil')), notes text, visit_date timestamptz not null default now());
create table donations (id uuid primary key default gen_random_uuid(), visit_id uuid references volunteer_visits(id), volunteer_id uuid not null references profiles(id), donor_id uuid not null references donors(id), amount numeric(14,0) not null check (amount > 0), category_id uuid references donation_categories(id), payment_method text not null check (payment_method in ('Cash Relawan','Transfer BNI','Transfer Mandiri','Transfer BSI','QRIS')), proof_url text, verification_status text not null default 'Pending' check (verification_status in ('Pending','Verified','Rejected')), verified_at timestamptz, verified_by uuid references profiles(id), created_at timestamptz not null default now());
create table app_settings (id uuid primary key default gen_random_uuid(), org_name text not null default 'Rumah Pelopor Indonesia', org_logo_url text, bank_accounts jsonb not null default '[]', receipt_footer_text text);`;

const MANIFEST_SNIPPET = `{
  "name": "RPI - Rumah Pelopor Indonesia",
  "short_name": "RPI Donasi",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/icons/rpi-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/rpi-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}`;

const OG_SNIPPET = `<title>RPI - Sistem Laporan Kunjungan & Donasi Lapangan</title>
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#2563eb">
<meta property="og:type" content="website">
<meta property="og:title" content="RPI - Sistem Laporan Kunjungan & Donasi Lapangan">
<meta property="og:description" content="Platform resmi Rumah Pelopor Indonesia untuk manajemen relawan lapangan, pencatatan kunjungan donatur secara real-time, transparansi dana, dan pelaporan eksekutif terintegrasi.">
<meta property="og:image" content="https://DOMAIN-ANDA/og-rpi.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://DOMAIN-ANDA/og-rpi.png">`;

const STATUSES = ['Prospek', 'Berminat', 'Menolak', 'Berhasil'];
const METHODS = ['Cash Relawan', 'Transfer BNI', 'Transfer Mandiri', 'Transfer BSI', 'QRIS'];
const METHOD_SHORT = { 'Cash Relawan': 'Cash', 'Transfer BNI': 'BNI', 'Transfer Mandiri': 'Mandiri', 'Transfer BSI': 'BSI', 'QRIS': 'QRIS' };
const TONE_BY_STATUS = { Prospek: 'warn', Berminat: 'info', Menolak: 'bad', Berhasil: 'ok', Pending: 'warn', Verified: 'ok', Rejected: 'bad' };
const TONE_CLASS = { ok: 'bg-okbg text-okfg', warn: 'bg-warnbg text-warnfg', bad: 'bg-badbg text-badfg', info: 'bg-infobg text-infofg' };
const STATUS_ICON = { Prospek: 'Clock', Berminat: 'Heart', Menolak: 'XCircle', Berhasil: 'CheckCircle2', Pending: 'Clock', Verified: 'CheckCircle2', Rejected: 'XCircle' };
const ROLE_LABEL = { volunteer: 'Relawan', coordinator: 'Koordinator', owner_admin: 'Owner / Admin' };

const NAV = {
  volunteer: [
    { id: 'home', label: 'Beranda', icon: 'Home' },
    { id: 'report', label: 'Lapor', icon: 'PlusCircle' },
    { id: 'history', label: 'Riwayat', icon: 'History' }
  ],
  coordinator: [
    { id: 'monitor', label: 'Monitoring', icon: 'Activity' },
    { id: 'moves', label: 'Pergerakan', icon: 'MapPin' }
  ],
  owner_admin: [
    { id: 'dash', label: 'Dashboard', icon: 'LayoutDashboard' },
    { id: 'verify', label: 'Verifikasi', icon: 'ShieldCheck' },
    { id: 'master', label: 'Master', icon: 'Settings' },
    { id: 'export', label: 'Ekspor', icon: 'Download' }
  ]
};

/* ---------- gaya komponen (Tailwind) ---------- */
const CARD = 'bg-surface border border-line rounded-2xl';
const BTN = 'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl font-semibold text-[15px] transition active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const CTA = BTN + ' bg-pink-600 hover:bg-pink-700 text-white';
const GHOST = BTN + ' bg-surface-2 hover:brightness-95 text-ink border border-line';
const SMALL = 'inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg text-[13px] font-semibold transition active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
const INPUT = 'w-full min-h-[44px] rounded-xl border border-line bg-surface text-ink px-3 text-[15px] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-blue-500';
const LABEL = 'block text-[13px] font-semibold text-ink-2 mb-1.5';

/* ---------- util ---------- */
const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const isoDay = (d) => { d = new Date(d); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const fmtShort = (d) => { d = new Date(d); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const fmtDate = (d) => { d = new Date(d); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); };
const fmtTime = (d) => { d = new Date(d); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtDT = (d) => fmtDate(d) + ', ' + fmtTime(d);
const rupiah = (n) => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n || 0));
const shortRp = (n) => { n = Number(n) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + ' M'; if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + ' jt'; if (n >= 1e3) return Math.round(n / 1e3) + ' rb'; return String(n); };
const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const timeAgo = (t) => {
  const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return 'baru saja';
  if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
  if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
  return Math.floor(s / 86400) + ' hari lalu';
};
const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* abaikan */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } };
const receiptNo = (d) => 'RPI-' + isoDay(d.created_at).replace(/-/g, '') + '-' + String(d.id).slice(-4).toUpperCase();
const waNumber = (p) => { const x = String(p || '').replace(/\D/g, ''); return x.startsWith('0') ? '62' + x.slice(1) : x; };

function terbilang(n) {
  n = Math.floor(n);
  const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  const f = (x) => {
    if (x < 12) return s[x];
    if (x < 20) return s[x - 10] + ' belas';
    if (x < 100) return s[Math.floor(x / 10)] + ' puluh' + (x % 10 ? ' ' + s[x % 10] : '');
    if (x < 200) return 'seratus' + (x - 100 ? ' ' + f(x - 100) : '');
    if (x < 1000) return s[Math.floor(x / 100)] + ' ratus' + (x % 100 ? ' ' + f(x % 100) : '');
    if (x < 2000) return 'seribu' + (x - 1000 ? ' ' + f(x - 1000) : '');
    if (x < 1e6) return f(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + f(x % 1000) : '');
    if (x < 1e9) return f(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 ? ' ' + f(x % 1e6) : '');
    if (x < 1e12) return f(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 ? ' ' + f(x % 1e9) : '');
    return String(x);
  };
  const out = n === 0 ? 'nol' : f(n);
  return out.charAt(0).toUpperCase() + out.slice(1) + ' rupiah';
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* lanjut ke cadangan */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

function imageToDataUrl(file, max, type) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('File tidak dapat dibaca'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Pilih file gambar (JPG atau PNG)'));
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(type === 'png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.7));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- data contoh ---------- */
const U = (p, n) => p + '000000-0000-4000-8000-' + String(n).padStart(12, '0');
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function buildSeed() {
  const rnd = mulberry32(2026);
  const now = Date.now();
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const profiles = [
    { id: U('b0', 1), full_name: 'Ahmad Fauzi', role: 'owner_admin', phone: '081200000001', created_at: new Date(now - 90 * 864e5).toISOString() },
    { id: U('b0', 2), full_name: 'Siti Rahmawati', role: 'coordinator', phone: '081200000002', created_at: new Date(now - 80 * 864e5).toISOString() },
    { id: U('b0', 3), full_name: 'Budi Santoso', role: 'volunteer', phone: '081200000003', created_at: new Date(now - 60 * 864e5).toISOString() },
    { id: U('b0', 4), full_name: 'Dewi Lestari', role: 'volunteer', phone: '081200000004', created_at: new Date(now - 55 * 864e5).toISOString() },
    { id: U('b0', 5), full_name: 'Rizky Maulana', role: 'volunteer', phone: '081200000005', created_at: new Date(now - 40 * 864e5).toISOString() },
    { id: U('b0', 6), full_name: 'Nur Hidayah', role: 'volunteer', phone: '081200000006', created_at: new Date(now - 30 * 864e5).toISOString() }
  ];
  const vols = profiles.filter((p) => p.role === 'volunteer');
  const catNames = ['Zakat Penghasilan', 'Fidyah', 'Sedekah', 'Bencana', 'Infak Pendidikan', 'Wakaf Sumur'];
  const categories = catNames.map((n, i) => ({ id: U('c1', i + 1), name: n, is_active: true }));
  const donorSeed = [
    ['Haji Mulyadi', 'Jl. Cihampelas No. 21, Bandung'], ['Ibu Ratna Wulandari', 'Jl. Dago Asri B-7, Bandung'], ['Pak Hendra Gunawan', 'Komplek Setiabudi Regency 14, Bandung'],
    ['Ibu Yuliana', 'Jl. Soekarno-Hatta 402, Bandung'], ['Pak Darmawan', 'Jl. Kopo Permai 9, Bandung'], ['Ibu Maryam', 'Jl. Buah Batu 118, Bandung'],
    ['Pak Teguh Prasetyo', 'Jl. Lembang Raya 5, Lembang'], ['Ibu Sartika', 'Jl. Cimahi Selatan 33, Cimahi'], ['Pak Anwar Hakim', 'Jl. Ujungberung 70, Bandung'], ['Ibu Fitri Handayani', 'Jl. Antapani Lama 12, Bandung']
  ];
  const donors = donorSeed.map((d, i) => ({ id: U('d0', i + 1), name: d[0], whatsapp: '0812000' + String(1000 + i * 37), address: d[1], created_by: vols[i % vols.length].id }));
  const notesBy = { Prospek: ['Perlu follow-up minggu depan', 'Meminta brosur program', 'Akan bicara dengan keluarga dulu'], Berminat: ['Berminat zakat penghasilan bulanan', 'Ingin berdonasi setelah gajian', 'Meminta nomor rekening resmi'], Menolak: ['Sudah berdonasi di lembaga lain', 'Belum bisa saat ini'], Berhasil: ['Donasi diterima langsung', 'Transfer dilakukan saat kunjungan', 'Donatur rutin, minta kuitansi'] };
  const visits = []; const donations = [];
  const amounts = [50000, 100000, 150000, 250000, 300000, 500000, 750000, 1000000, 2000000];
  for (let i = 0; i < 48; i++) {
    const today = i < 7;
    const daysAgo = today ? 0 : 1 + Math.floor(rnd() * 13);
    let t;
    if (today) t = now - Math.floor(rnd() * 6 * 3600e3) - 5 * 60e3;
    else { const d = new Date(now - daysAgo * 864e5); d.setHours(8 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), 0, 0); t = d.getTime(); }
    const r = rnd();
    const status = r < 0.42 ? 'Berhasil' : r < 0.62 ? 'Berminat' : r < 0.84 ? 'Prospek' : 'Menolak';
    const v = pick(vols); const donor = pick(donors);
    const visit = { id: U('e0', i + 1), volunteer_id: v.id, donor_id: donor.id, status, notes: pick(notesBy[status]), visit_date: new Date(t).toISOString() };
    visits.push(visit);
    if (status === 'Berhasil') {
      const m = rnd() < 0.34 ? 'Cash Relawan' : pick(METHODS.slice(1));
      const vr = rnd();
      const recent = daysAgo === 0;
      const ver = recent ? (vr < 0.7 ? 'Pending' : 'Verified') : (vr < 0.12 ? 'Pending' : vr < 0.2 ? 'Rejected' : 'Verified');
      const created = new Date(t + 10 * 60e3).toISOString();
      donations.push({
        id: U('f0', i + 1), visit_id: visit.id, volunteer_id: v.id, donor_id: donor.id, amount: pick(amounts), category_id: pick(categories).id,
        payment_method: m, proof_url: m === 'Cash Relawan' ? null : 'demo:bukti', verification_status: ver,
        verified_at: ver === 'Pending' ? null : new Date(t + 5 * 3600e3).toISOString(), verified_by: ver === 'Pending' ? null : profiles[0].id, created_at: created
      });
    }
  }
  const settings = {
    id: U('a0', 1), org_name: 'Rumah Pelopor Indonesia', org_logo_url: null,
    bank_accounts: [
      { bank: 'BNI', number: '0000000001', holder: 'Rumah Pelopor Indonesia' },
      { bank: 'Mandiri', number: '0000000002', holder: 'Rumah Pelopor Indonesia' },
      { bank: 'BSI', number: '0000000003', holder: 'Rumah Pelopor Indonesia' }
    ],
    receipt_footer_text: 'Jazakumullah khairan katsiran. Semoga donasi Anda menjadi amal jariyah dan keberkahan bagi keluarga.'
  };
  return { profiles, donation_categories: categories, donors, volunteer_visits: visits, donations, settings };
}

function loadLocal() {
  try {
    const raw = lsGet(LS_DATA); if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && d.profiles && d.donations && d.settings && d.donation_categories && d.donors && d.volunteer_visits) return d;
  } catch (e) { /* data rusak, pakai contoh */ }
  return null;
}

/* ---------- store: Supabase live bila terjangkau, selain itu mode demo lokal ---------- */
function useStore(notify) {
  const [db, setDb] = useState(() => loadLocal() || buildSeed());
  const [conn, setConn] = useState({ state: 'checking', msg: '' });
  const connRef = useRef(conn); connRef.current = conn;
  const sbRef = useRef(null);
  const queueRef = useRef(Promise.resolve());

  const loadRemote = useCallback(async () => {
    const sb = sbRef.current; if (!sb) return;
    const names = ['profiles', 'donation_categories', 'donors', 'volunteer_visits', 'donations', 'app_settings'];
    const res = await Promise.all(names.map((n) => sb.from(n).select('*')));
    const bad = res.find((r) => r.error);
    if (bad) throw bad.error;
    setDb((cur) => {
      const next = { ...cur };
      ['profiles', 'donation_categories', 'donors', 'volunteer_visits', 'donations'].forEach((n, i) => { if (res[i].data && res[i].data.length) next[n] = res[i].data; });
      const st = res[5].data && res[5].data[0];
      if (st) next.settings = { ...cur.settings, ...st, bank_accounts: Array.isArray(st.bank_accounts) ? st.bank_accounts : cur.settings.bank_accounts };
      return next;
    });
  }, []);

  const connect = useCallback(async () => {
    setConn({ state: 'checking', msg: '' });
    try {
      if (!window.supabase || !window.supabase.createClient) throw new Error('Library Supabase tidak termuat');
      if (!sbRef.current) sbRef.current = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const probe = sbRef.current.from('app_settings').select('id').limit(1);
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Server tidak merespons dalam 7 detik')), 7000));
      const r = await Promise.race([probe, timeout]);
      if (r.error) throw new Error(r.error.message || 'Tidak dapat terhubung');
      await loadRemote();
      setConn({ state: 'live', msg: '' });
    } catch (e) {
      setConn({ state: 'demo', msg: (e && e.message) ? e.message : 'Tidak dapat terhubung' });
    }
  }, [loadRemote]);

  useEffect(() => { connect(); }, [connect]);

  // realtime: muat ulang saat ada perubahan di database
  useEffect(() => {
    if (conn.state !== 'live' || !sbRef.current) return;
    let ch;
    try {
      ch = sbRef.current.channel('rpi-live').on('postgres_changes', { event: '*', schema: 'public' }, () => { loadRemote().catch(() => {}); }).subscribe();
    } catch (e) { /* realtime opsional */ }
    return () => { try { if (ch) sbRef.current.removeChannel(ch); } catch (e) { /* abaikan */ } };
  }, [conn.state, loadRemote]);

  // mode demo: simpan ke penyimpanan browser (jika tersedia)
  useEffect(() => { if (conn.state !== 'live') { try { lsSet(LS_DATA, JSON.stringify(db)); } catch (e) { /* abaikan */ } } }, [db, conn.state]);

  const push = useCallback(async (table, op, row) => {
    if (connRef.current.state !== 'live' || !sbRef.current) return;
    const sb = sbRef.current;
    try {
      let r;
      if (op === 'insert') r = await sb.from(table).insert(row);
      else if (op === 'update') { const { id, ...patch } = row; r = await sb.from(table).update(patch).eq('id', id); }
      else if (op === 'delete') r = await sb.from(table).delete().eq('id', row.id);
      else r = await sb.from(table).upsert(row);
      if (r.error) throw r.error;
    } catch (e) { notify('Gagal menyimpan ke Supabase: ' + (e.message || 'cek RLS & skema'), 'bad'); }
  }, [notify]);

  const enqueue = useCallback((fn) => { queueRef.current = queueRef.current.then(fn).catch(() => {}); }, []);

  const actions = useMemo(() => ({
    add: (table, row) => { setDb((d) => ({ ...d, [table]: [...d[table], row] })); enqueue(() => push(table, 'insert', row)); return row; },
    update: (table, id, patch) => { setDb((d) => ({ ...d, [table]: d[table].map((r) => r.id === id ? { ...r, ...patch } : r) })); enqueue(() => push(table, 'update', { id, ...patch })); },
    remove: (table, id) => { setDb((d) => ({ ...d, [table]: d[table].filter((r) => r.id !== id) })); enqueue(() => push(table, 'delete', { id })); },
    saveSettings: (patch) => {
      setDb((d) => { const settings = { ...d.settings, ...patch }; enqueue(() => push('app_settings', 'upsert', settings)); return { ...d, settings }; });
    },
    reset: () => { lsDel(LS_DATA); setDb(buildSeed()); }
  }), [enqueue, push]);

  return { db, conn, actions, reconnect: connect };
}

const Ctx = createContext(null);
const useApp = () => useContext(Ctx);

/* ---------- komponen dasar ---------- */
const FallbackIcon = (p) => <svg width={p.size || 18} height={p.size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg>;
function Icon({ name, size = 18, className }) {
  const C = (window.lucideReact && window.lucideReact[name]) || FallbackIcon;
  return <C size={size} className={className} strokeWidth={2} aria-hidden="true" />;
}

function Badge({ status }) {
  return (
    <span className={'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ' + TONE_CLASS[TONE_BY_STATUS[status] || 'info']}>
      <Icon name={STATUS_ICON[status] || 'Circle'} size={13} />{status}
    </span>
  );
}

function Metric({ label, value, sub, icon }) {
  return (
    <div className={CARD + ' p-4 min-w-0'}>
      <div className="flex items-center gap-2 text-muted text-[13px] font-semibold"><Icon name={icon} size={16} /><span className="truncate">{label}</span></div>
      <div className="font-display font-bold text-[24px] leading-tight mt-2 num break-words">{value}</div>
      {sub ? <div className="text-[12.5px] text-muted mt-1">{sub}</div> : null}
    </div>
  );
}

function Sheet({ title, onClose, children, wide }) {
  useEffect(() => { const h = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/55" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={'sheet bg-bg text-ink w-full ' + (wide ? 'md:max-w-2xl' : 'md:max-w-md') + ' max-h-[92%] overflow-y-auto rounded-t-3xl md:rounded-3xl border border-line'} onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="sticky top-0 bg-bg z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <h2 className="font-display font-bold text-[18px] truncate">{title}</h2>
          <button className={SMALL + ' bg-surface-2 text-ink border border-line'} onClick={onClose} aria-label="Tutup"><Icon name="X" size={16} />Tutup</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Empty({ icon, title, text }) {
  return (
    <div className={CARD + ' p-8 text-center'}>
      <div className="mx-auto w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center text-muted"><Icon name={icon} size={22} /></div>
      <div className="font-display font-bold text-[17px] mt-3">{title}</div>
      <div className="text-muted text-[14px] mt-1">{text}</div>
    </div>
  );
}

function CopyButton({ text, label = 'Salin', className }) {
  const { notify } = useApp();
  return <button className={className || (SMALL + ' bg-surface-2 text-ink border border-line')} onClick={async () => { const ok = await copyText(text); notify(ok ? 'Tersalin ke clipboard' : 'Gagal menyalin, pilih teks secara manual', ok ? 'ok' : 'bad'); }}><Icon name="Copy" size={14} />{label}</button>;
}

function Seg({ options, value, onChange, label }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-surface-2 border border-line" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className={'min-h-[36px] px-3 rounded-lg text-[13.5px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ' + (value === o.value ? 'bg-surface text-ink shadow-sm border border-line' : 'text-muted border border-transparent')}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- selector data turunan ---------- */
function useDerived() {
  const { db } = useApp();
  return useMemo(() => {
    const idx = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
    const profilesById = idx(db.profiles), donorsById = idx(db.donors), catsById = idx(db.donation_categories);
    const donationByVisit = {}; db.donations.forEach((d) => { if (d.visit_id) donationByVisit[d.visit_id] = d; });
    const visits = db.volunteer_visits.map((v) => ({ ...v, donor: donorsById[v.donor_id], volunteer: profilesById[v.volunteer_id], donation: donationByVisit[v.visit_id] || donationByVisit[v.id] })).sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    const donations = db.donations.map((d) => ({ ...d, donor: donorsById[d.donor_id], volunteer: profilesById[d.volunteer_id], category: catsById[d.category_id] })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { profilesById, donorsById, catsById, visits, donations };
  }, [db]);
}

/* =====================================================================
   RELAWAN
   ===================================================================== */
function VisitCard({ v }) {
  const { openReceipt, openProof } = useApp();
  const d = v.donation;
  return (
    <div className={CARD + ' p-4'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-[16px] truncate">{v.donor ? v.donor.name : 'Donatur'}</div>
          <div className="text-[13px] text-muted">{fmtDT(v.visit_date)}{v.volunteer ? ' · ' + v.volunteer.full_name : ''}</div>
        </div>
        <Badge status={v.status} />
      </div>
      {v.notes ? <p className="text-[14px] text-ink-2 mt-2 break-words">{v.notes}</p> : null}
      {d ? (
        <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-display font-bold text-[18px] num">{rupiah(d.amount)}</div>
            <div className="text-[12.5px] text-muted">{(d.category && d.category.name) || 'Tanpa kategori'} · {d.payment_method}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge status={d.verification_status} />
            {d.proof_url ? <button className={SMALL + ' bg-surface-2 text-ink border border-line'} onClick={() => openProof(d.id)}><Icon name="Image" size={14} />Bukti</button> : null}
            {d.verification_status !== 'Rejected' ? <button className={SMALL + ' bg-pink-600 hover:bg-pink-700 text-white'} onClick={() => openReceipt(d.id)}><Icon name="Receipt" size={14} />Kuitansi</button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VolunteerHome() {
  const { me, setTab } = useApp();
  const { visits, donations } = useDerived();
  const mine = visits.filter((v) => v.volunteer_id === me.id);
  const myDon = donations.filter((d) => d.volunteer_id === me.id);
  const today = mine.filter((v) => startOfDay(v.visit_date) === startOfDay(Date.now()));
  const verified = sum(myDon.filter((d) => d.verification_status === 'Verified'), (d) => d.amount);
  const pending = myDon.filter((d) => d.verification_status === 'Pending');
  const won = mine.filter((v) => v.status === 'Berhasil').length;
  const conv = mine.length ? Math.round(won / mine.length * 100) : 0;
  return (
    <div className="grid gap-4">
      <div className="hero-grad rounded-2xl p-5 text-white">
        <div className="text-[13px] font-semibold opacity-90">Halo, {me.full_name.split(' ')[0]}</div>
        <div className="font-display font-bold text-[22px] leading-snug mt-1 text-balance">Sudah ada {today.length} kunjungan hari ini.</div>
        <button className={CTA + ' mt-4 w-full sm:w-auto'} onClick={() => setTab('report')}><Icon name="PlusCircle" size={18} />Lapor Kunjungan Baru</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Metric label="Total kunjungan" value={mine.length} sub={won + ' berhasil · ' + conv + '%'} icon="MapPin" />
        <Metric label="Dana terverifikasi" value={rupiah(verified)} sub="Hanya donasi Verified" icon="Wallet" />
        <Metric label="Menunggu verifikasi" value={pending.length} sub={rupiah(sum(pending, (d) => d.amount))} icon="Clock" />
        <Metric label="Hari ini" value={today.length} sub="kunjungan tercatat" icon="CalendarDays" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-bold text-[18px]">Kunjungan terbaru</h2>
          <button className="text-[13.5px] font-semibold text-brand min-h-[36px]" onClick={() => setTab('history')}>Lihat semua</button>
        </div>
        <div className="grid gap-3">
          {mine.slice(0, 3).map((v) => <VisitCard key={v.id} v={v} />)}
          {!mine.length ? <Empty icon="MapPin" title="Belum ada kunjungan" text="Laporan pertama Anda akan muncul di sini." /> : null}
        </div>
      </div>
    </div>
  );
}

function ReportForm() {
  const { db, actions, me, notify, setTab, openReceipt } = useApp();
  const donorsSorted = useMemo(() => [...db.donors].sort((a, b) => a.name.localeCompare(b.name)), [db.donors]);
  const activeCats = db.donation_categories.filter((c) => c.is_active);
  const [mode, setMode] = useState('existing');
  const [donorId, setDonorId] = useState('');
  const [nd, setNd] = useState({ name: '', wa: '', addr: '' });
  const [status, setStatus] = useState('Prospek');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(isoDay(Date.now()));
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('');
  const [method, setMethod] = useState('Cash Relawan');
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isWin = status === 'Berhasil';
  const needProof = isWin && method !== 'Cash Relawan';

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setBusy(true);
    try { setProof(await imageToDataUrl(f, 800, 'jpeg')); setErr(''); } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  function submit(e) {
    e.preventDefault();
    if (mode === 'existing' && !donorId) return setErr('Pilih donatur atau tambahkan donatur baru.');
    if (mode === 'new' && !nd.name.trim()) return setErr('Nama donatur wajib diisi.');
    const amt = Number(String(amount).replace(/\D/g, ''));
    if (isWin) {
      if (!amt) return setErr('Isi nominal donasi.');
      if (!cat) return setErr('Pilih kategori donasi.');
      if (needProof && !proof) return setErr('Unggah bukti transfer atau QRIS terlebih dahulu.');
    }
    let did = donorId;
    if (mode === 'new') { did = uid(); actions.add('donors', { id: did, name: nd.name.trim(), whatsapp: nd.wa.trim(), address: nd.addr.trim(), created_by: me.id }); }
    const vid = uid();
    const stamp = new Date(date + 'T' + fmtTime(Date.now())).toISOString();
    actions.add('volunteer_visits', { id: vid, volunteer_id: me.id, donor_id: did, status, notes: notes.trim(), visit_date: stamp });
    let newDon = null;
    if (isWin) {
      newDon = uid();
      actions.add('donations', { id: newDon, visit_id: vid, volunteer_id: me.id, donor_id: did, amount: amt, category_id: cat, payment_method: method, proof_url: method === 'Cash Relawan' ? null : proof, verification_status: 'Pending', verified_at: null, verified_by: null, created_at: new Date().toISOString() });
    }
    setErr(''); setDonorId(''); setNd({ name: '', wa: '', addr: '' }); setStatus('Prospek'); setNotes(''); setAmount(''); setCat(''); setProof(null); setMethod('Cash Relawan'); setMode('existing');
    notify(isWin ? 'Laporan dan donasi tersimpan, menunggu verifikasi' : 'Laporan kunjungan tersimpan');
    setTab('history');
    if (newDon) openReceipt(newDon);
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <div className={CARD + ' p-4 grid gap-4'}>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-semibold text-ink-2" htmlFor="donor-sel">Donatur</label>
            <button type="button" className="text-[13px] font-semibold text-brand min-h-[32px]" onClick={() => { setMode(mode === 'existing' ? 'new' : 'existing'); setErr(''); }}>{mode === 'existing' ? '+ Donatur baru' : 'Pilih dari daftar'}</button>
          </div>
          {mode === 'existing' ? (
            <select id="donor-sel" className={INPUT} value={donorId} onChange={(e) => setDonorId(e.target.value)}>
              <option value="">Pilih donatur…</option>
              {donorsSorted.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : (
            <div className="grid gap-3">
              <input id="nd-name" className={INPUT} placeholder="Nama lengkap donatur" value={nd.name} onChange={(e) => setNd({ ...nd, name: e.target.value })} />
              <input id="nd-wa" className={INPUT} inputMode="tel" placeholder="Nomor WhatsApp, contoh 0812xxxxxxx" value={nd.wa} onChange={(e) => setNd({ ...nd, wa: e.target.value })} />
              <textarea id="nd-addr" className={INPUT + ' py-2.5 min-h-[72px]'} placeholder="Alamat" value={nd.addr} onChange={(e) => setNd({ ...nd, addr: e.target.value })} />
            </div>
          )}
        </div>
        <div>
          <span className={LABEL}>Status kunjungan</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUSES.map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
                className={'min-h-[48px] rounded-xl border text-[14px] font-semibold flex items-center justify-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ' + (status === s ? TONE_CLASS[TONE_BY_STATUS[s]] + ' border-current' : 'bg-surface text-ink-2 border-line')}>
                <Icon name={STATUS_ICON[s]} size={16} />{s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="v-date">Tanggal kunjungan</label>
            <input id="v-date" type="date" className={INPUT} value={date} max={isoDay(Date.now())} onChange={(e) => setDate(e.target.value || isoDay(Date.now()))} />
          </div>
          <div>
            <label className={LABEL} htmlFor="v-notes">Catatan</label>
            <input id="v-notes" className={INPUT} placeholder="Hasil obrolan, tindak lanjut" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {isWin ? (
        <div className={CARD + ' p-4 grid gap-4'}>
          <h2 className="font-display font-bold text-[17px]">Detail donasi</h2>
          <div>
            <label className={LABEL} htmlFor="amt">Nominal (Rp)</label>
            <input id="amt" className={INPUT + ' text-[18px] font-bold num'} inputMode="numeric" placeholder="0" value={amount ? new Intl.NumberFormat('id-ID').format(Number(String(amount).replace(/\D/g, ''))) : ''} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
            <div className="flex flex-wrap gap-2 mt-2">
              {[50000, 100000, 250000, 500000, 1000000].map((n) => <button key={n} type="button" className={SMALL + ' bg-surface-2 text-ink border border-line'} onClick={() => setAmount(String(n))}>{shortRp(n)}</button>)}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="cat">Kategori</label>
              <select id="cat" className={INPUT} value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Pilih kategori…</option>
                {activeCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="mth">Metode pembayaran</label>
              <select id="mth" className={INPUT} value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {method !== 'Cash Relawan' ? (
            <div>
              <span className={LABEL}>Bukti {method === 'QRIS' ? 'pembayaran QRIS' : 'transfer'}</span>
              <label htmlFor="proof" className="flex items-center justify-center gap-2 min-h-[88px] rounded-xl border-2 border-dashed border-line bg-surface-2 text-ink-2 font-semibold cursor-pointer text-center px-3">
                {proof ? <img src={proof} alt="Pratinjau bukti" className="max-h-24 rounded-lg" /> : <><Icon name="Upload" size={18} />Ketuk untuk unggah foto bukti</>}
              </label>
              <input id="proof" type="file" accept="image/*" className="sr-only" onChange={onFile} />
              {proof ? <button type="button" className="text-[13px] font-semibold text-badfg mt-2 min-h-[32px]" onClick={() => setProof(null)}>Hapus gambar</button> : null}
            </div>
          ) : <p className="text-[13px] text-muted">Uang tunai dicatat atas nama relawan dan baru dihitung setelah diverifikasi admin.</p>}
        </div>
      ) : null}

      {err ? <div role="alert" className="rounded-xl bg-badbg text-badfg px-4 py-3 text-[14px] font-semibold flex items-start gap-2"><Icon name="AlertCircle" size={18} className="shrink-0 mt-0.5" />{err}</div> : null}
      <button type="submit" disabled={busy} className={CTA + ' w-full min-h-[52px] text-[16px]'}><Icon name="Send" size={18} />Kirim Laporan</button>
    </form>
  );
}

function History() {
  const { me } = useApp();
  const { visits } = useDerived();
  const [f, setF] = useState('Semua');
  const mine = visits.filter((v) => v.volunteer_id === me.id);
  const shown = f === 'Semua' ? mine : mine.filter((v) => v.status === f);
  return (
    <div className="grid gap-4">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {['Semua', ...STATUSES].map((s) => (
          <button key={s} onClick={() => setF(s)} aria-pressed={f === s} className={'shrink-0 min-h-[36px] px-3.5 rounded-full text-[13.5px] font-semibold border transition ' + (f === s ? 'bg-brand text-white border-transparent' : 'bg-surface text-ink-2 border-line')} style={f === s ? { color: '#fff', background: '#2563eb' } : null}>{s}{s !== 'Semua' ? ' ' + mine.filter((v) => v.status === s).length : ' ' + mine.length}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((v) => <VisitCard key={v.id} v={v} />)}
      </div>
      {!shown.length ? <Empty icon="History" title="Belum ada riwayat" text="Kunjungan dengan status ini belum tercatat." /> : null}
    </div>
  );
}

/* =====================================================================
   KOORDINATOR
   ===================================================================== */
function Monitoring() {
  const { db } = useApp();
  const { visits, donations } = useDerived();
  const vols = db.profiles.filter((p) => p.role === 'volunteer');
  const todayStart = startOfDay(Date.now());
  const rows = vols.map((v) => {
    const mv = visits.filter((x) => x.volunteer_id === v.id);
    const md = donations.filter((x) => x.volunteer_id === v.id);
    const last = mv[0] ? new Date(mv[0].visit_date).getTime() : 0;
    const age = Date.now() - last;
    const act = !last ? 'Belum aktif' : age < 3 * 3600e3 ? 'Aktif' : last >= todayStart ? 'Hari ini' : 'Tidak aktif';
    return { v, total: mv.length, today: mv.filter((x) => new Date(x.visit_date).getTime() >= todayStart).length, won: mv.filter((x) => x.status === 'Berhasil').length, verified: sum(md.filter((x) => x.verification_status === 'Verified'), (x) => x.amount), pending: md.filter((x) => x.verification_status === 'Pending').length, last, act };
  }).sort((a, b) => b.last - a.last);
  const todayV = visits.filter((x) => new Date(x.visit_date).getTime() >= todayStart);
  const activeNow = rows.filter((r) => r.act === 'Aktif').length;
  const totalWon = visits.filter((x) => x.status === 'Berhasil').length;
  const actTone = { Aktif: 'ok', 'Hari ini': 'info', 'Tidak aktif': 'warn', 'Belum aktif': 'bad' };
  const ActPill = ({ a }) => <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ' + TONE_CLASS[actTone[a]]}><span className={'w-2 h-2 rounded-full bg-current ' + (a === 'Aktif' ? 'pulse-dot' : '')} />{a}</span>;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Relawan aktif" value={activeNow + ' / ' + vols.length} sub="lapor dalam 3 jam terakhir" icon="Users" />
        <Metric label="Kunjungan hari ini" value={todayV.length} sub={todayV.filter((x) => x.status === 'Berhasil').length + ' berhasil'} icon="MapPin" />
        <Metric label="Total kunjungan tim" value={visits.length} sub={visits.length ? Math.round(totalWon / visits.length * 100) + '% konversi' : '-'} icon="TrendingUp" />
        <Metric label="Dana terverifikasi" value={rupiah(sum(donations.filter((d) => d.verification_status === 'Verified'), (d) => d.amount))} sub="seluruh tim" icon="Wallet" />
      </div>
      <div>
        <h2 className="font-display font-bold text-[18px] mb-2">Pergerakan relawan</h2>
        <div className="grid gap-3 md:hidden">
          {rows.map((r) => (
            <div key={r.v.id} className={CARD + ' p-4'}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="font-semibold truncate">{r.v.full_name}</div><div className="text-[12.5px] text-muted">{r.last ? 'Terakhir ' + timeAgo(r.last) : 'Belum ada laporan'}</div></div>
                <ActPill a={r.act} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div className="bg-surface-2 rounded-xl py-2"><div className="font-display font-bold text-[18px] num">{r.today}</div><div className="text-[11.5px] text-muted">Hari ini</div></div>
                <div className="bg-surface-2 rounded-xl py-2"><div className="font-display font-bold text-[18px] num">{r.won}/{r.total}</div><div className="text-[11.5px] text-muted">Berhasil</div></div>
                <div className="bg-surface-2 rounded-xl py-2"><div className="font-display font-bold text-[16px] num">{shortRp(r.verified)}</div><div className="text-[11.5px] text-muted">Verified</div></div>
              </div>
            </div>
          ))}
        </div>
        <div className={CARD + ' hidden md:block overflow-x-auto'}>
          <table className="w-full text-[14px]">
            <thead><tr className="text-left text-muted text-[12.5px] uppercase tracking-wide border-b border-line"><th className="p-3 font-semibold">Relawan</th><th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold text-right">Hari ini</th><th className="p-3 font-semibold text-right">Total</th><th className="p-3 font-semibold text-right">Berhasil</th><th className="p-3 font-semibold text-right">Dana verified</th><th className="p-3 font-semibold text-right">Pending</th><th className="p-3 font-semibold">Terakhir</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.v.id} className="border-b border-line last:border-0">
                  <td className="p-3 font-semibold">{r.v.full_name}</td><td className="p-3"><ActPill a={r.act} /></td>
                  <td className="p-3 text-right num">{r.today}</td><td className="p-3 text-right num">{r.total}</td><td className="p-3 text-right num">{r.won}</td>
                  <td className="p-3 text-right num">{rupiah(r.verified)}</td><td className="p-3 text-right num">{r.pending}</td><td className="p-3 text-muted">{r.last ? timeAgo(r.last) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Moves() {
  const { db } = useApp();
  const { visits } = useDerived();
  const [vol, setVol] = useState('all');
  const [st, setSt] = useState('all');
  const vols = db.profiles.filter((p) => p.role === 'volunteer');
  const shown = visits.filter((v) => (vol === 'all' || v.volunteer_id === vol) && (st === 'all' || v.status === st)).slice(0, 60);
  return (
    <div className="grid gap-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className={LABEL} htmlFor="f-vol">Relawan</label>
          <select id="f-vol" className={INPUT} value={vol} onChange={(e) => setVol(e.target.value)}><option value="all">Semua relawan</option>{vols.map((v) => <option key={v.id} value={v.id}>{v.full_name}</option>)}</select></div>
        <div><label className={LABEL} htmlFor="f-st">Status kunjungan</label>
          <select id="f-st" className={INPUT} value={st} onChange={(e) => setSt(e.target.value)}><option value="all">Semua status</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      <div className="grid gap-3 md:hidden">
        {shown.map((v) => <VisitCard key={v.id} v={v} />)}
      </div>
      <div className={CARD + ' hidden md:block overflow-x-auto'}>
        <table className="w-full text-[14px]">
          <thead><tr className="text-left text-muted text-[12.5px] uppercase tracking-wide border-b border-line"><th className="p-3 font-semibold">Waktu</th><th className="p-3 font-semibold">Relawan</th><th className="p-3 font-semibold">Donatur</th><th className="p-3 font-semibold">Status</th><th className="p-3 font-semibold text-right">Donasi</th><th className="p-3 font-semibold">Verifikasi</th></tr></thead>
          <tbody>
            {shown.map((v) => (
              <tr key={v.id} className="border-b border-line last:border-0">
                <td className="p-3 whitespace-nowrap text-muted">{fmtDT(v.visit_date)}</td><td className="p-3 font-semibold">{v.volunteer ? v.volunteer.full_name : '-'}</td><td className="p-3">{v.donor ? v.donor.name : '-'}</td>
                <td className="p-3"><Badge status={v.status} /></td><td className="p-3 text-right num">{v.donation ? rupiah(v.donation.amount) : '-'}</td><td className="p-3">{v.donation ? <Badge status={v.donation.verification_status} /> : <span className="text-muted">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length ? <Empty icon="Search" title="Tidak ada data" text="Ubah filter untuk melihat kunjungan lain." /> : null}
    </div>
  );
}

/* =====================================================================
   OWNER / ADMIN
   ===================================================================== */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return <div className="bg-surface text-ink border border-line rounded-xl px-3 py-2 text-[13px] shadow-lg"><div className="text-muted">{label || payload[0].payload.name}</div><div className="font-bold num">{rupiah(payload[0].value)}</div></div>;
};

function SimpleBars({ data, xKey }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return <div className="grid gap-2">{data.map((d, i) => <div key={i} className="grid grid-cols-[96px_1fr_64px] items-center gap-2 text-[12.5px]"><span className="truncate text-ink-2">{d[xKey]}</span><span className="h-3 rounded-sm" style={{ background: 'var(--c1)', width: (d.total / max * 100) + '%' }} /><span className="num text-right text-muted">{shortRp(d.total)}</span></div>)}</div>;
}

function ChartCard({ title, sub, data, xKey, children }) {
  const [table, setTable] = useState(false);
  return (
    <div className={CARD + ' p-4 min-w-0'}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0"><h3 className="font-display font-bold text-[17px]">{title}</h3><div className="text-[12.5px] text-muted">{sub}</div></div>
        <Seg label="Tampilan" value={table ? 't' : 'g'} onChange={(v) => setTable(v === 't')} options={[{ value: 'g', label: 'Grafik' }, { value: 't', label: 'Tabel' }]} />
      </div>
      {table ? (
        <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
          <table className="w-full text-[13.5px]"><thead><tr className="text-left text-muted text-[12px] uppercase tracking-wide"><th className="py-1.5 font-semibold">{xKey === 'label' ? 'Tanggal' : 'Nama'}</th><th className="py-1.5 font-semibold text-right">Terverifikasi</th></tr></thead>
            <tbody>{data.map((d, i) => <tr key={i} className="border-t border-line"><td className="py-1.5">{d[xKey]}</td><td className="py-1.5 text-right num">{rupiah(d.total)}</td></tr>)}</tbody></table>
        </div>
      ) : children}
    </div>
  );
}

function Dashboard() {
  const { db } = useApp();
  const { visits, donations } = useDerived();
  const [period, setPeriod] = useState(30);
  const R = window.Recharts;
  const from = startOfDay(Date.now() - (period - 1) * 864e5);
  const dons = donations.filter((d) => new Date(d.created_at).getTime() >= from);
  const vis = visits.filter((v) => new Date(v.visit_date).getTime() >= from);
  const verified = dons.filter((d) => d.verification_status === 'Verified');
  const pending = dons.filter((d) => d.verification_status === 'Pending');
  const total = sum(verified, (d) => d.amount);
  const won = vis.filter((v) => v.status === 'Berhasil').length;

  const trend = useMemo(() => {
    const map = {}; const out = [];
    for (let i = 0; i < period; i++) { const d = new Date(from + i * 864e5); const row = { key: isoDay(d), label: fmtShort(d), total: 0 }; map[row.key] = row; out.push(row); }
    verified.forEach((d) => { const r = map[isoDay(d.created_at)]; if (r) r.total += d.amount; });
    return out;
  }, [period, donations]);
  const byCat = useMemo(() => {
    const m = {}; verified.forEach((d) => { const n = d.category ? d.category.name : 'Tanpa kategori'; m[n] = (m[n] || 0) + d.amount; });
    return Object.entries(m).map(([name, t]) => ({ name, total: t })).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [period, donations]);
  const byMethod = useMemo(() => METHODS.map((m) => ({ name: METHOD_SHORT[m], total: sum(verified.filter((d) => d.payment_method === m), (d) => d.amount) })), [period, donations]);
  const board = db.profiles.filter((p) => p.role === 'volunteer').map((p) => ({ p, total: sum(verified.filter((d) => d.volunteer_id === p.id), (d) => d.amount), n: verified.filter((d) => d.volunteer_id === p.id).length })).sort((a, b) => b.total - a.total);
  const maxB = Math.max(1, ...board.map((b) => b.total));
  const tickStyle = { fill: 'var(--muted)', fontSize: 11 };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[13.5px] text-muted">Total dana hanya bertambah setelah donasi berstatus Verified.</p>
        <Seg label="Periode" value={period} onChange={setPeriod} options={[{ value: 7, label: '7 hari' }, { value: 14, label: '14 hari' }, { value: 30, label: '30 hari' }]} />
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="hero-grad rounded-2xl p-5 text-white col-span-full lg:col-span-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold opacity-95"><Icon name="Wallet" size={16} />Dana terverifikasi</div>
          <div className="font-display font-bold text-[30px] leading-tight mt-2 num break-words">{rupiah(total)}</div>
          <div className="text-[13px] opacity-90 mt-1">{verified.length} donasi · {period} hari terakhir</div>
        </div>
        <div className="grid grid-cols-3 gap-3 col-span-full lg:col-span-3">
          <Metric label="Menunggu verifikasi" value={pending.length} sub={rupiah(sum(pending, (d) => d.amount))} icon="Clock" />
          <Metric label="Kunjungan" value={vis.length} sub={vis.length ? Math.round(won / vis.length * 100) + '% berhasil' : '-'} icon="MapPin" />
          <Metric label="Donatur" value={db.donors.length} sub="terdaftar" icon="Users" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ChartCard title="Tren harian" sub="Dana terverifikasi per hari" data={trend} xKey="label">
            {R ? (
              <div style={{ width: '100%', height: 240 }}>
                <R.ResponsiveContainer width="100%" height="100%">
                  <R.AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--c1)" stopOpacity="0.28" /><stop offset="100%" stopColor="var(--c1)" stopOpacity="0" /></linearGradient></defs>
                    <R.CartesianGrid stroke="var(--grid)" vertical={false} />
                    <R.XAxis dataKey="label" tick={tickStyle} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} minTickGap={22} />
                    <R.YAxis tick={tickStyle} axisLine={false} tickLine={false} width={44} tickFormatter={shortRp} />
                    <R.Tooltip content={<ChartTip />} cursor={{ stroke: 'var(--axis)' }} />
                    <R.Area type="monotone" dataKey="total" stroke="var(--c1)" strokeWidth={2} fill="url(#trendFill)" dot={false} activeDot={{ r: 5, fill: 'var(--c1)', stroke: 'var(--surface)', strokeWidth: 2 }} />
                  </R.AreaChart>
                </R.ResponsiveContainer>
              </div>
            ) : <SimpleBars data={trend.slice(-10)} xKey="label" />}
          </ChartCard>
        </div>
        <ChartCard title="Per kategori" sub="Dana terverifikasi" data={byCat} xKey="name">
          {!byCat.length ? <p className="text-muted text-[14px] py-8 text-center">Belum ada donasi terverifikasi pada periode ini.</p> : R ? (
            <div style={{ width: '100%', height: Math.max(180, byCat.length * 40 + 24) }}>
              <R.ResponsiveContainer width="100%" height="100%">
                <R.BarChart data={byCat} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <R.CartesianGrid stroke="var(--grid)" horizontal={false} />
                  <R.XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={shortRp} />
                  <R.YAxis type="category" dataKey="name" width={108} tick={tickStyle} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} />
                  <R.Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-2)' }} />
                  <R.Bar dataKey="total" fill="var(--c1)" radius={[0, 4, 4, 0]} barSize={16} />
                </R.BarChart>
              </R.ResponsiveContainer>
            </div>
          ) : <SimpleBars data={byCat} xKey="name" />}
        </ChartCard>
        <ChartCard title="Metode pembayaran" sub="Dana terverifikasi" data={byMethod} xKey="name">
          {R ? (
            <div style={{ width: '100%', height: 230 }}>
              <R.ResponsiveContainer width="100%" height="100%">
                <R.BarChart data={byMethod} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <R.CartesianGrid stroke="var(--grid)" vertical={false} />
                  <R.XAxis dataKey="name" tick={tickStyle} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} />
                  <R.YAxis tick={tickStyle} axisLine={false} tickLine={false} width={44} tickFormatter={shortRp} />
                  <R.Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface-2)' }} />
                  <R.Bar dataKey="total" fill="var(--c1)" radius={[4, 4, 0, 0]} maxBarSize={44} />
                </R.BarChart>
              </R.ResponsiveContainer>
            </div>
          ) : <SimpleBars data={byMethod} xKey="name" />}
        </ChartCard>
      </div>

      <div className={CARD + ' p-4'}>
        <h3 className="font-display font-bold text-[17px] mb-3">Peringkat relawan</h3>
        <div className="grid gap-3">
          {board.map((b, i) => (
            <div key={b.p.id}>
              <div className="flex items-baseline justify-between gap-2 text-[14px]"><span className="font-semibold truncate">{i + 1}. {b.p.full_name}</span><span className="num text-ink-2 whitespace-nowrap">{rupiah(b.total)} · {b.n} donasi</span></div>
              <div className="h-2 rounded-full bg-surface-2 mt-1.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: (b.total / maxB * 100) + '%', background: 'var(--c1)' }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Verify() {
  const { actions, me, notify, openProof, openReceipt } = useApp();
  const { donations } = useDerived();
  const [f, setF] = useState('Pending');
  const counts = { Pending: 0, Verified: 0, Rejected: 0 }; donations.forEach((d) => { counts[d.verification_status]++; });
  const shown = donations.filter((d) => d.verification_status === f);
  const set = (d, s) => { actions.update('donations', d.id, { verification_status: s, verified_at: s === 'Pending' ? null : new Date().toISOString(), verified_by: s === 'Pending' ? null : me.id }); notify(s === 'Verified' ? 'Donasi disetujui, total dana bertambah' : s === 'Rejected' ? 'Donasi ditolak' : 'Dikembalikan ke status Pending', s === 'Rejected' ? 'bad' : 'ok'); };
  return (
    <div className="grid gap-4">
      <Seg label="Status" value={f} onChange={setF} options={['Pending', 'Verified', 'Rejected'].map((s) => ({ value: s, label: s + ' ' + counts[s] }))} />
      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((d) => (
          <div key={d.id} className={CARD + ' p-4'}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="font-display font-bold text-[22px] num">{rupiah(d.amount)}</div><div className="text-[13px] text-muted">{receiptNo(d)}</div></div>
              <Badge status={d.verification_status} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13.5px] mt-3">
              <dt className="text-muted">Donatur</dt><dd className="font-semibold break-words">{d.donor ? d.donor.name : '-'}</dd>
              <dt className="text-muted">Relawan</dt><dd className="break-words">{d.volunteer ? d.volunteer.full_name : '-'}</dd>
              <dt className="text-muted">Kategori</dt><dd>{d.category ? d.category.name : '-'}</dd>
              <dt className="text-muted">Metode</dt><dd>{d.payment_method}</dd>
              <dt className="text-muted">Dilaporkan</dt><dd>{fmtDT(d.created_at)}</dd>
            </dl>
            <div className="flex flex-wrap gap-2 mt-4">
              {d.proof_url ? <button className={SMALL + ' bg-surface-2 text-ink border border-line'} onClick={() => openProof(d.id)}><Icon name="Image" size={14} />Lihat bukti</button> : <span className="text-[12.5px] text-muted self-center">Tunai, tanpa bukti</span>}
              <button className={SMALL + ' bg-surface-2 text-ink border border-line'} onClick={() => openReceipt(d.id)}><Icon name="Receipt" size={14} />Kuitansi</button>
            </div>
            <div className="flex gap-2 mt-3">
              {d.verification_status === 'Pending' ? (
                <>
                  <button className={BTN + ' flex-1 bg-emerald-600 hover:bg-emerald-700 text-white'} onClick={() => set(d, 'Verified')}><Icon name="Check" size={18} />Approve</button>
                  <button className={BTN + ' flex-1 bg-rose-600 hover:bg-rose-700 text-white'} onClick={() => set(d, 'Rejected')}><Icon name="X" size={18} />Reject</button>
                </>
              ) : <button className={GHOST + ' flex-1'} onClick={() => set(d, 'Pending')}><Icon name="Undo2" size={16} />Kembalikan ke Pending</button>}
            </div>
          </div>
        ))}
      </div>
      {!shown.length ? <Empty icon="ShieldCheck" title={f === 'Pending' ? 'Semua donasi sudah diperiksa' : 'Belum ada data'} text={f === 'Pending' ? 'Donasi baru dari relawan akan muncul di sini.' : 'Tidak ada donasi dengan status ' + f + '.'} /> : null}
    </div>
  );
}

function CategoryRow({ c }) {
  const { actions, notify } = useApp();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(c.name);
  const [conf, setConf] = useState(false);
  return (
    <li className="flex items-center gap-2 py-2.5 border-t border-line first:border-0 flex-wrap">
      {edit ? (
        <input className={INPUT + ' flex-1 min-w-[140px]'} value={name} autoFocus aria-label="Nama kategori" onChange={(e) => setName(e.target.value)} />
      ) : <span className={'flex-1 min-w-[120px] font-semibold ' + (c.is_active ? '' : 'text-muted line-through')}>{c.name}</span>}
      {edit ? (
        <button className={SMALL + ' bg-pink-600 hover:bg-pink-700 text-white'} onClick={() => { if (!name.trim()) return; actions.update('donation_categories', c.id, { name: name.trim() }); setEdit(false); notify('Kategori diperbarui'); }}>Simpan</button>
      ) : (
        <>
          <button className={SMALL + ' ' + (c.is_active ? TONE_CLASS.ok : TONE_CLASS.warn)} onClick={() => actions.update('donation_categories', c.id, { is_active: !c.is_active })} aria-pressed={c.is_active}>{c.is_active ? 'Aktif' : 'Nonaktif'}</button>
          <button className={SMALL + ' bg-surface-2 text-ink border border-line'} onClick={() => setEdit(true)} aria-label={'Ubah ' + c.name}><Icon name="Pencil" size={14} /></button>
          {conf ? <button className={SMALL + ' bg-rose-600 text-white'} onClick={() => { actions.remove('donation_categories', c.id); notify('Kategori dihapus'); }}>Yakin hapus?</button>
            : <button className={SMALL + ' bg-surface-2 text-badfg border border-line'} onClick={() => { setConf(true); setTimeout(() => setConf(false), 3500); }} aria-label={'Hapus ' + c.name}><Icon name="Trash2" size={14} /></button>}
        </>
      )}
    </li>
  );
}

function MasterData() {
  const { db, actions, notify, conn, reconnect, openInstall } = useApp();
  const st = db.settings;
  const [org, setOrg] = useState(st.org_name);
  const [foot, setFoot] = useState(st.receipt_footer_text || '');
  const [newCat, setNewCat] = useState('');
  const [bank, setBank] = useState({ bank: '', number: '', holder: '' });
  const [tech, setTech] = useState(false);
  const logo = st.org_logo_url || LOGO;
  async function onLogo(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { actions.saveSettings({ org_logo_url: await imageToDataUrl(f, 400, 'png') }); notify('Logo diperbarui'); } catch (x) { notify(x.message, 'bad'); }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <section className={CARD + ' p-4 grid gap-4'}>
        <h2 className="font-display font-bold text-[18px]">Profil lembaga</h2>
        <div className="flex items-center gap-4">
          <div className="w-24 h-20 rounded-xl bg-white border border-line flex items-center justify-center p-1.5 shrink-0"><img src={logo} alt="Logo lembaga" className="max-h-full max-w-full object-contain" /></div>
          <div className="grid gap-2">
            <label htmlFor="logo-up" className={SMALL + ' bg-surface-2 text-ink border border-line cursor-pointer'}><Icon name="Upload" size={14} />Ganti logo</label>
            <input id="logo-up" type="file" accept="image/*" className="sr-only" onChange={onLogo} />
            {st.org_logo_url ? <button className="text-[13px] font-semibold text-badfg text-left min-h-[28px]" onClick={() => actions.saveSettings({ org_logo_url: null })}>Pakai logo RPI</button> : null}
          </div>
        </div>
        <div><label className={LABEL} htmlFor="org-name">Nama lembaga</label><input id="org-name" className={INPUT} value={org} onChange={(e) => setOrg(e.target.value)} /></div>
        <div><label className={LABEL} htmlFor="org-foot">Teks penutup kuitansi</label><textarea id="org-foot" className={INPUT + ' py-2.5 min-h-[88px]'} value={foot} onChange={(e) => setFoot(e.target.value)} /></div>
        <button className={CTA} onClick={() => { actions.saveSettings({ org_name: org.trim() || 'Rumah Pelopor Indonesia', receipt_footer_text: foot }); notify('Profil lembaga disimpan'); }}>Simpan perubahan</button>
      </section>

      <section className={CARD + ' p-4'}>
        <h2 className="font-display font-bold text-[18px] mb-2">Kategori donasi</h2>
        <ul>{db.donation_categories.map((c) => <CategoryRow key={c.id} c={c} />)}</ul>
        <form className="flex gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); if (!newCat.trim()) return; actions.add('donation_categories', { id: uid(), name: newCat.trim(), is_active: true }); setNewCat(''); notify('Kategori ditambahkan'); }}>
          <input id="new-cat" className={INPUT} placeholder="Kategori baru" aria-label="Kategori baru" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <button type="submit" className={CTA + ' shrink-0'}><Icon name="Plus" size={18} />Tambah</button>
        </form>
      </section>

      <section className={CARD + ' p-4 lg:col-span-2'}>
        <h2 className="font-display font-bold text-[18px] mb-2">Rekening bank</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {st.bank_accounts.map((b, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface-2 p-3 flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="font-display font-bold text-[16px]">{b.bank}</div><div className="num text-[14px] break-all">{b.number}</div><div className="text-[12.5px] text-muted break-words">{b.holder}</div></div>
              <button className={SMALL + ' bg-surface text-badfg border border-line shrink-0'} aria-label={'Hapus rekening ' + b.bank} onClick={() => { actions.saveSettings({ bank_accounts: st.bank_accounts.filter((_, j) => j !== i) }); notify('Rekening dihapus'); }}><Icon name="Trash2" size={14} /></button>
            </div>
          ))}
        </div>
        <form className="grid gap-2 sm:grid-cols-[1fr_1.2fr_1.4fr_auto] mt-3" onSubmit={(e) => { e.preventDefault(); if (!bank.bank.trim() || !bank.number.trim()) return notify('Isi nama bank dan nomor rekening', 'bad'); actions.saveSettings({ bank_accounts: [...st.bank_accounts, { bank: bank.bank.trim(), number: bank.number.trim(), holder: bank.holder.trim() || org }] }); setBank({ bank: '', number: '', holder: '' }); notify('Rekening ditambahkan'); }}>
          <input id="bk-name" className={INPUT} placeholder="Bank" aria-label="Nama bank" value={bank.bank} onChange={(e) => setBank({ ...bank, bank: e.target.value })} />
          <input id="bk-num" className={INPUT} inputMode="numeric" placeholder="Nomor rekening" aria-label="Nomor rekening" value={bank.number} onChange={(e) => setBank({ ...bank, number: e.target.value })} />
          <input id="bk-hold" className={INPUT} placeholder="Atas nama" aria-label="Atas nama" value={bank.holder} onChange={(e) => setBank({ ...bank, holder: e.target.value })} />
          <button type="submit" className={CTA}><Icon name="Plus" size={18} />Tambah</button>
        </form>
        <p className="text-[12.5px] text-muted mt-2">Nomor rekening pada data contoh hanya placeholder. Ganti dengan rekening resmi RPI.</p>
      </section>

      <section className={CARD + ' p-4 lg:col-span-2'}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0"><h2 className="font-display font-bold text-[18px]">Koneksi & pengaturan teknis</h2>
            <p className="text-[13.5px] text-muted">{conn.state === 'live' ? 'Terhubung ke Supabase, data dibaca dan disimpan langsung.' : 'Mode demo: data tersimpan di browser ini. ' + (conn.msg ? '(' + conn.msg + ')' : '')}</p></div>
          <div className="flex gap-2 flex-wrap">
            <button className={GHOST} onClick={reconnect}><Icon name="RefreshCw" size={16} />Coba hubungkan</button>
            <button className={GHOST} onClick={() => setTech(!tech)}><Icon name="Code2" size={16} />{tech ? 'Sembunyikan kode' : 'Lihat kode'}</button>
          </div>
        </div>
        {tech ? (
          <div className="grid gap-4 mt-4">
            {[['manifest.json', MANIFEST_SNIPPET], ['Meta OpenGraph & Twitter', OG_SNIPPET], ['Skema Supabase (SQL)', SCHEMA_SQL]].map(([t, code]) => (
              <div key={t} className="min-w-0"><div className="flex items-center justify-between gap-2 mb-1.5"><h3 className="font-semibold text-[14px]">{t}</h3><CopyButton text={code} /></div><pre className="code max-h-56">{code}</pre></div>
            ))}
            <div className="flex gap-2 flex-wrap">
              <button className={GHOST} onClick={openInstall}><Icon name="Smartphone" size={16} />Lihat panduan pasang aplikasi</button>
              <button className={GHOST} onClick={() => { actions.reset(); notify('Data contoh dipulihkan'); }}><Icon name="RotateCcw" size={16} />Pulihkan data contoh</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ExportView() {
  const { db } = useApp();
  const { visits, donations } = useDerived();
  const [ds, setDs] = useState('donations');
  const [fmt, setFmt] = useState('csv');
  const taRef = useRef(null);
  const { head, rows } = useMemo(() => {
    if (ds === 'donations') return { head: ['No Kuitansi', 'Tanggal', 'Relawan', 'Donatur', 'WhatsApp', 'Kategori', 'Metode', 'Nominal', 'Status Verifikasi', 'Tanggal Verifikasi'], rows: donations.map((d) => [receiptNo(d), isoDay(d.created_at), d.volunteer ? d.volunteer.full_name : '', d.donor ? d.donor.name : '', d.donor ? d.donor.whatsapp : '', d.category ? d.category.name : '', d.payment_method, d.amount, d.verification_status, d.verified_at ? isoDay(d.verified_at) : '']) };
    if (ds === 'visits') return { head: ['Tanggal', 'Jam', 'Relawan', 'Donatur', 'Status', 'Catatan'], rows: visits.map((v) => [isoDay(v.visit_date), fmtTime(v.visit_date), v.volunteer ? v.volunteer.full_name : '', v.donor ? v.donor.name : '', v.status, v.notes || '']) };
    return { head: ['Nama', 'WhatsApp', 'Alamat'], rows: db.donors.map((d) => [d.name, d.whatsapp || '', d.address || '']) };
  }, [ds, donations, visits, db.donors]);
  const sep = fmt === 'csv' ? ',' : '\t';
  const esc = (x) => { const s = String(x == null ? '' : x); return fmt === 'csv' ? (/[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s) : s.replace(/[\t\n]/g, ' '); };
  const text = [head, ...rows].map((r) => r.map(esc).join(sep)).join('\n');
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <Seg label="Data" value={ds} onChange={setDs} options={[{ value: 'donations', label: 'Donasi' }, { value: 'visits', label: 'Kunjungan' }, { value: 'donors', label: 'Donatur' }]} />
        <Seg label="Format" value={fmt} onChange={setFmt} options={[{ value: 'csv', label: 'CSV' }, { value: 'tsv', label: 'Excel (tempel)' }]} />
      </div>
      <div className={CARD + ' p-4 grid gap-3'}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div><div className="font-display font-bold text-[17px]">{rows.length} baris siap diekspor</div>
            <p className="text-[13px] text-muted max-w-xl">Unduhan file diblokir di halaman ini. Salin hasilnya, lalu tempel di Excel, Google Sheets, atau simpan sebagai file {fmt === 'csv' ? '.csv' : '.tsv'}.</p></div>
          <CopyButton text={text} label={'Salin ' + (fmt === 'csv' ? 'CSV' : 'untuk Excel')} className={CTA} />
        </div>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-[13px] min-w-[560px]">
            <thead><tr className="bg-surface-2 text-left text-muted text-[12px] uppercase tracking-wide">{head.map((h) => <th key={h} className="p-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 6).map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className="p-2.5 whitespace-nowrap num">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <label className={LABEL} htmlFor="exp-text">Isi {fmt === 'csv' ? 'CSV' : 'TSV'}</label>
        <textarea id="exp-text" ref={taRef} readOnly className={INPUT + ' py-2.5 font-mono text-[12px] min-h-[160px] whitespace-pre'} value={text} onFocus={(e) => e.target.select()} />
      </div>
    </div>
  );
}

/* =====================================================================
   KUITANSI, BUKTI, PASANG APLIKASI
   ===================================================================== */
function ReceiptModal({ id, onClose }) {
  const { db, notify } = useApp();
  const { donations } = useDerived();
  const d = donations.find((x) => x.id === id);
  if (!d) return null;
  const st = db.settings; const logo = st.org_logo_url || LOGO;
  const verified = d.verification_status === 'Verified';
  const text = ['*KUITANSI DONASI*', st.org_name, 'No: ' + receiptNo(d), 'Tanggal: ' + fmtDT(d.created_at), 'Diterima dari: ' + (d.donor ? d.donor.name : '-'), 'Nominal: ' + rupiah(d.amount), 'Terbilang: ' + terbilang(d.amount), 'Kategori: ' + (d.category ? d.category.name : '-'), 'Metode: ' + d.payment_method, 'Relawan: ' + (d.volunteer ? d.volunteer.full_name + (d.volunteer.phone ? ' (' + d.volunteer.phone + ')' : '') : '-'), 'Status: ' + (verified ? 'Terverifikasi' : 'Menunggu verifikasi'), '', st.receipt_footer_text || ''].join('\n');
  const wa = d.donor && d.donor.whatsapp ? 'https://wa.me/' + waNumber(d.donor.whatsapp) + '?text=' + encodeURIComponent(text) : null;
  const row = (k, v) => <div className="grid grid-cols-[104px_1fr] gap-2 py-1.5 text-[13.5px]" style={{ borderTop: '1px dashed var(--paper-line)' }}><dt style={{ opacity: .65 }}>{k}</dt><dd className="font-semibold break-words">{v}</dd></div>;
  return (
    <Sheet title="Kuitansi digital" onClose={onClose}>
      <div className="rounded-2xl p-5" style={{ background: 'var(--paper)', color: 'var(--paper-ink)', border: '1px solid var(--paper-line)' }}>
        <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '2px solid var(--paper-ink)' }}>
          <img src={logo} alt="Logo" className="h-14 w-auto max-w-[110px] object-contain" />
          <div className="min-w-0"><div className="font-display font-bold text-[16px] leading-tight">{st.org_name}</div><div className="text-[12px]" style={{ opacity: .65 }}>Kuitansi penerimaan donasi</div></div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-3 flex-wrap">
          <div className="num text-[13px] font-bold">{receiptNo(d)}</div>
          <span className="text-[11.5px] font-bold uppercase tracking-wider px-2 py-1 rounded" style={verified ? { background: '#d1fae5', color: '#065f46' } : { background: '#fef3c7', color: '#92400e' }}>{verified ? 'Terverifikasi' : 'Menunggu verifikasi'}</span>
        </div>
        <div className="font-display font-bold text-[30px] mt-2 num break-words">{rupiah(d.amount)}</div>
        <div className="text-[13px] italic mb-2" style={{ opacity: .75 }}>{terbilang(d.amount)}</div>
        <dl>
          {row('Diterima dari', d.donor ? d.donor.name : '-')}
          {row('Tanggal', fmtDT(d.created_at))}
          {row('Kategori', d.category ? d.category.name : '-')}
          {row('Metode', d.payment_method)}
          {row('Relawan', d.volunteer ? d.volunteer.full_name : '-')}
          {d.volunteer && d.volunteer.phone ? row('Kontak relawan', d.volunteer.phone) : null}
        </dl>
        {st.receipt_footer_text ? <p className="text-[12.5px] mt-3 pt-3" style={{ borderTop: '1px dashed var(--paper-line)', opacity: .8 }}>{st.receipt_footer_text}</p> : null}
      </div>
      <div className="grid gap-2 mt-4 sm:grid-cols-2">
        <CopyButton text={text} label="Salin teks kuitansi" className={GHOST} />
        {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className={CTA}><Icon name="MessageCircle" size={18} />Kirim via WhatsApp</a> : <span className="text-[13px] text-muted self-center">Nomor WhatsApp donatur belum diisi.</span>}
      </div>
      <p className="text-[12.5px] text-muted mt-3">Tombol cetak tidak tersedia di halaman ini. Simpan kuitansi dengan screenshot atau kirim teksnya lewat WhatsApp.</p>
    </Sheet>
  );
}

function ProofModal({ id, onClose }) {
  const { donations } = useDerived();
  const d = donations.find((x) => x.id === id);
  if (!d) return null;
  const real = d.proof_url && d.proof_url.indexOf('data:') === 0;
  return (
    <Sheet title="Bukti pembayaran" onClose={onClose}>
      {real ? <img src={d.proof_url} alt="Bukti pembayaran" className="rounded-xl mx-auto max-h-[60vh]" /> : d.proof_url && d.proof_url.indexOf('http') === 0 ? <img src={d.proof_url} alt="Bukti pembayaran" className="rounded-xl mx-auto max-h-[60vh]" /> : (
        <div className="rounded-xl bg-surface-2 border border-line p-8 text-center"><Icon name="Image" size={28} className="mx-auto text-muted" /><div className="font-semibold mt-2">Bukti contoh</div><p className="text-[13px] text-muted mt-1">Data contoh tidak menyertakan foto. Bukti yang diunggah relawan tampil di sini.</p></div>
      )}
      <div className="text-[13.5px] text-ink-2 mt-3 text-center">{rupiah(d.amount)} · {d.payment_method} · {d.donor ? d.donor.name : ''}</div>
    </Sheet>
  );
}

function InstallGuide({ onClose, deferred, onPrompt }) {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const steps = ios
    ? ['Buka halaman ini di Safari.', 'Ketuk tombol Bagikan (kotak dengan panah ke atas) di bilah bawah.', 'Gulir, lalu pilih "Tambah ke Layar Utama".', 'Ketuk "Tambah". Ikon RPI muncul di beranda HP.']
    : ['Buka halaman ini di Chrome.', 'Ketuk menu titik tiga di kanan atas.', 'Pilih "Instal aplikasi" atau "Tambahkan ke layar utama".', 'Ketuk "Instal". Ikon RPI muncul di beranda HP.'];
  return (
    <Sheet title="Tambahkan ke Layar Utama" onClose={onClose}>
      <div className="flex items-center gap-3 mb-4"><div className="w-16 h-14 rounded-xl bg-white border border-line p-1 flex items-center justify-center"><img src={LOGO} alt="" className="max-h-full" /></div><p className="text-[14px] text-ink-2">Pasang RPI Donasi agar terbuka layar penuh seperti aplikasi biasa dan lebih cepat dari beranda HP.</p></div>
      {deferred ? <button className={CTA + ' w-full mb-4'} onClick={onPrompt}><Icon name="Download" size={18} />Pasang sekarang</button> : null}
      <ol className="grid gap-2.5">{steps.map((s, i) => <li key={i} className="flex gap-3 items-start"><span className="w-7 h-7 shrink-0 rounded-full bg-infobg text-infofg font-bold text-[13px] flex items-center justify-center">{i + 1}</span><span className="text-[14.5px] pt-0.5">{s}</span></li>)}</ol>
    </Sheet>
  );
}

function useInstall() {
  const isStandalone = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || lsGet(LS_INSTALLED) === '1'; } catch (e) { return false; } };
  const [standalone, setStandalone] = useState(isStandalone);
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(lsGet(LS_DISMISS) === '1');
  useEffect(() => {
    let mq; try { mq = window.matchMedia('(display-mode: standalone)'); } catch (e) { /* abaikan */ }
    const onMode = () => setStandalone(isStandalone());
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => { lsSet(LS_INSTALLED, '1'); setStandalone(true); setDeferred(null); };
    if (mq && mq.addEventListener) mq.addEventListener('change', onMode);
    window.addEventListener('beforeinstallprompt', onPrompt); window.addEventListener('appinstalled', onInstalled);
    return () => { if (mq && mq.removeEventListener) mq.removeEventListener('change', onMode); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const show = mobile && !standalone && !dismissed;
  const dismiss = () => { lsSet(LS_DISMISS, '1'); setDismissed(true); };
  const prompt = async () => { if (!deferred) return; try { deferred.prompt(); const r = await deferred.userChoice; if (r && r.outcome === 'accepted') { lsSet(LS_INSTALLED, '1'); setStandalone(true); } } catch (e) { /* abaikan */ } setDeferred(null); };
  return { show, deferred, dismiss, prompt };
}

/* =====================================================================
   APLIKASI
   ===================================================================== */
function ConnBadge({ conn, onRetry }) {
  const map = { live: ['Wifi', 'Live', 'Terhubung ke Supabase'], demo: ['WifiOff', 'Demo', 'Data contoh, tersimpan di browser ini'], checking: ['RefreshCw', 'Menghubungkan', 'Memeriksa koneksi Supabase'] };
  const [ic, lb, tt] = map[conn.state];
  return <button onClick={onRetry} title={tt} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[12.5px] font-semibold px-3 min-h-[32px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white"><Icon name={ic} size={14} className={conn.state === 'checking' ? 'animate-spin' : ''} />{lb}</button>;
}

function App() {
  const [toast, setToast] = useState(null);
  const notify = useCallback((msg, kind) => setToast({ msg, kind: kind || 'ok', k: Date.now() }), []);
  const { db, conn, actions, reconnect } = useStore(notify);
  const [role, setRole] = useState('volunteer');
  const [tab, setTab] = useState('home');
  const [volId, setVolId] = useState(null);
  const [receipt, openReceipt] = useState(null);
  const [proof, openProof] = useState(null);
  const [installOpen, setInstallOpen] = useState(false);
  const install = useInstall();

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { // manifest langsung dari halaman (bekerja bila browser mengizinkan)
    try {
      const m = JSON.parse(MANIFEST_SNIPPET); m.start_url = location.href.split('#')[0]; m.icons = [{ src: LOGO, sizes: '192x192', type: 'image/png' }, { src: LOGO, sizes: '512x512', type: 'image/png' }];
      const l = document.createElement('link'); l.rel = 'manifest'; l.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' })); document.head.appendChild(l);
    } catch (e) { /* abaikan */ }
  }, []);

  const vols = db.profiles.filter((p) => p.role === 'volunteer');
  const volunteer = vols.find((v) => v.id === volId) || vols[0];
  const me = role === 'volunteer' ? volunteer : (db.profiles.find((p) => p.role === role) || db.profiles[0]);
  const nav = NAV[role];
  const switchRole = (r) => { setRole(r); setTab(NAV[r][0].id); window.scrollTo(0, 0); };
  const goTab = (t) => { setTab(t); window.scrollTo(0, 0); };
  const ctx = { db, actions, notify, me, role, setTab: goTab, openReceipt, openProof, conn, reconnect, openInstall: () => setInstallOpen(true) };
  const titles = { home: 'Beranda', report: 'Laporan Kunjungan', history: 'Riwayat Kunjungan', monitor: 'Monitoring Tim', moves: 'Pergerakan Lapangan', dash: 'Executive Dashboard', verify: 'Verifikasi Donasi', master: 'Master Data & Setting', export: 'Ekspor Data' };

  let view = null;
  if (role === 'volunteer') view = tab === 'home' ? <VolunteerHome /> : tab === 'report' ? <ReportForm /> : <History />;
  else if (role === 'coordinator') view = tab === 'monitor' ? <Monitoring /> : <Moves />;
  else view = tab === 'dash' ? <Dashboard /> : tab === 'verify' ? <Verify /> : tab === 'master' ? <MasterData /> : <ExportView />;

  const pendingCount = db.donations.filter((d) => d.verification_status === 'Pending').length;

  return (
    <Ctx.Provider value={ctx}>
      <div className="min-h-screen bg-bg text-ink">
        <header className="hero-grad text-white">
          <div className="gutter max-w-6xl mx-auto" style={{ paddingBlock: '14px' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-12 rounded-xl bg-white flex items-center justify-center p-1 shrink-0"><img src={db.settings.org_logo_url || LOGO} alt="Logo RPI" className="max-h-full max-w-full object-contain" /></div>
                <div className="min-w-0"><div className="font-display font-bold text-[18px] leading-tight truncate">{db.settings.org_name}</div><div className="text-[12.5px] opacity-90 truncate">Laporan kunjungan & donasi lapangan</div></div>
              </div>
              <ConnBadge conn={conn} onRetry={reconnect} />
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <div className="inline-flex p-1 rounded-xl bg-black/20 max-w-full" role="group" aria-label="Pilih peran">
                {[['volunteer', 'Relawan', 'Heart'], ['coordinator', 'Koordinator', 'Users'], ['owner_admin', 'Owner', 'Crown']].map(([r, l, ic]) => (
                  <button key={r} onClick={() => switchRole(r)} aria-pressed={role === r} className={'min-h-[38px] px-3 sm:px-4 rounded-lg text-[13.5px] font-bold inline-flex items-center gap-1.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white ' + (role === r ? 'bg-white text-blue-700' : 'text-white')}><Icon name={ic} size={15} />{l}</button>
                ))}
              </div>
              {role === 'volunteer' ? (
                <select aria-label="Relawan aktif" className="min-h-[38px] rounded-xl bg-black/20 text-white text-[13.5px] font-semibold px-3 border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white max-w-full" value={volunteer ? volunteer.id : ''} onChange={(e) => setVolId(e.target.value)}>
                  {vols.map((v) => <option key={v.id} value={v.id} style={{ color: '#0f172a' }}>{v.full_name}</option>)}
                </select>
              ) : <span className="text-[13.5px] font-semibold opacity-95 truncate">{me ? me.full_name : ''} · {ROLE_LABEL[role]}</span>}
            </div>
          </div>
        </header>

        <div className="gutter max-w-6xl mx-auto md:grid md:grid-cols-[210px_minmax(0,1fr)] md:gap-6" style={{ paddingBlock: '16px 112px' }}>
          <aside className="hidden md:block">
            <nav className="sticky top-4 grid gap-1" aria-label="Navigasi utama">
              {nav.map((n) => (
                <button key={n.id} onClick={() => goTab(n.id)} aria-current={tab === n.id ? 'page' : undefined} className={'flex items-center gap-3 min-h-[46px] px-3 rounded-xl text-[15px] font-semibold text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ' + (tab === n.id ? 'bg-infobg text-infofg' : 'text-ink-2 hover:bg-surface-2')}>
                  <Icon name={n.icon} size={19} />{n.label}{n.id === 'verify' && pendingCount ? <span className="ml-auto bg-pink-600 text-white text-[11.5px] rounded-full px-2 py-0.5 num">{pendingCount}</span> : null}
                </button>
              ))}
            </nav>
          </aside>
          <main className="min-w-0">
            {install.show ? (
              <div className="rounded-2xl p-4 mb-4 flex items-center gap-3 border border-line bg-infobg text-infofg">
                <Icon name="Smartphone" size={22} className="shrink-0" />
                <div className="min-w-0 flex-1"><div className="font-bold text-[14.5px]">Pasang RPI di layar utama</div><div className="text-[12.5px] opacity-90">Buka lebih cepat, tampil layar penuh.</div></div>
                <button className={SMALL + ' bg-pink-600 hover:bg-pink-700 text-white shrink-0'} onClick={() => install.deferred ? install.prompt() : setInstallOpen(true)}>Pasang</button>
                <button className={SMALL + ' shrink-0 px-2'} onClick={install.dismiss} aria-label="Tutup banner"><Icon name="X" size={16} /></button>
              </div>
            ) : null}
            <h1 className="font-display font-bold text-[24px] md:text-[28px] leading-tight mb-4 text-balance">{titles[tab]}</h1>
            {view}
          </main>
        </div>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line" aria-label="Navigasi utama" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'max(8px, env(safe-area-inset-left, 0px))', paddingRight: 'max(8px, env(safe-area-inset-right, 0px))' }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(' + nav.length + ', minmax(0, 1fr))' }}>
            {nav.map((n) => {
              const on = tab === n.id; const cta = n.id === 'report';
              return (
                <button key={n.id} onClick={() => goTab(n.id)} aria-current={on ? 'page' : undefined} className="relative flex flex-col items-center justify-center gap-0.5 min-h-[58px] text-[11.5px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-xl" style={{ color: on ? 'var(--brand)' : 'var(--muted)' }}>
                  {cta ? <span className="w-11 h-11 -mt-5 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg border-4" style={{ borderColor: 'var(--surface)' }}><Icon name="Plus" size={22} /></span> : <Icon name={n.icon} size={22} />}
                  {n.label}
                  {n.id === 'verify' && pendingCount ? <span className="absolute top-1.5 right-[22%] bg-pink-600 text-white text-[10.5px] rounded-full px-1.5 num">{pendingCount}</span> : null}
                </button>
              );
            })}
          </div>
        </nav>

        {toast ? <div key={toast.k} role="status" className="fixed z-40 left-1/2 -translate-x-1/2 max-w-[92%] rounded-xl px-4 py-3 text-[14px] font-semibold shadow-xl flex items-center gap-2" style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', background: toast.kind === 'bad' ? '#be123c' : '#0f172a', color: '#fff' }}><Icon name={toast.kind === 'bad' ? 'AlertCircle' : 'CheckCircle2'} size={18} className="shrink-0" /><span>{toast.msg}</span></div> : null}
        {receipt ? <ReceiptModal id={receipt} onClose={() => openReceipt(null)} /> : null}
        {proof ? <ProofModal id={proof} onClose={() => openProof(null)} /> : null}
        {installOpen ? <InstallGuide onClose={() => setInstallOpen(false)} deferred={install.deferred} onPrompt={() => { install.prompt(); setInstallOpen(false); }} /> : null}
      </div>
    </Ctx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
})();
